# 배포/인프라 구축 기록

`claude` 계정(sudo 권한 없음) 위에 web(Nginx, 13000) / was(Spring Boot, 13001) 분리 구조를 만들고,
GitHub Actions self-hosted runner로 CI/CD까지 연결한 과정. starter(11000/11001), flash-coupon(12000/12001)과
동일한 패턴을 그대로 재사용했다.

## 아키텍처

```
Internet/LAN
     │
     ▼
Nginx :13000  ──/ ───────────────► /home/claude/leader/frontend/dist (정적 파일)
              ──/api/* ──────────► 127.0.0.1:13001 (Spring Boot, proxy_pass)
                                        │
                                        ▼
                          systemd --user: leader-backend.service
                          (java -jar /home/claude/leader/app.jar)
```

## 1. 계정 내 설치 (sudo 불필요) — 완료됨

Java/Maven(SDKMAN), Node(nvm)는 starter/flash-coupon 구축 시 이미 설치되어 있어 재사용.

### 1-1. 백엔드 systemd --user 서비스

```bash
mkdir -p ~/.config/systemd/user
cp deploy/leader-backend.service ~/.config/systemd/user/
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user daemon-reload
systemctl --user enable --now leader-backend
```

### 1-2. GitHub Actions self-hosted runner

```bash
TOKEN=$(gh api -X POST repos/jjh1215/leader/actions/runners/registration-token --jq '.token')

mkdir -p ~/leader-actions-runner && cd ~/leader-actions-runner
curl -o actions-runner-linux-x64-2.336.0.tar.gz -L \
  https://github.com/actions/runner/releases/download/v2.336.0/actions-runner-linux-x64-2.336.0.tar.gz
tar xzf actions-runner-linux-x64-2.336.0.tar.gz

./config.sh --url https://github.com/jjh1215/leader --token "$TOKEN" \
  --unattended --name claude-leader-runner --work _work \
  --labels self-hosted,linux,x64,claude

cp ~/leader/deploy/leader-runner.service ~/.config/systemd/user/
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user daemon-reload
systemctl --user enable --now leader-runner
```

## 2. sudo가 필요한 시스템 설정 — 아직 미완료, 다른 세션에서 실행 필요

`claude` 계정에서는 직접 실행 불가. sudo 권한이 있는 별도 세션에서 아래를 순서대로 실행할 것.

### 2-1. Nginx 설정 배포

```bash
sudo cp /home/claude/leader/deploy/nginx-leader.conf /etc/nginx/conf.d/leader.conf
sudo nginx -t
sudo systemctl reload nginx
```

nginx 자체와 nginx.conf의 기본 80포트 제거는 starter 구축 시 이미 처리되어 있으므로 다시 할 필요 없음.

### 2-2. SELinux 컨텍스트

```bash
sudo semanage fcontext -a -t httpd_sys_content_t "/home/claude/leader/frontend/dist(/.*)?"
sudo restorecon -Rv /home/claude/leader/frontend/dist
```

`httpd_can_network_connect`는 starter 구축 시 이미 활성화되어 있어 재설정 불필요.

sudo 불필요 (같이 진행 가능):

```bash
chmod o+x /home/claude/leader /home/claude/leader/frontend
```

### 2-3. 방화벽

```bash
sudo firewall-cmd --permanent --add-port=13000/tcp
sudo firewall-cmd --reload
```

13001(백엔드)은 열지 않는다 — nginx를 통해서만 접근.

### 2-4. sudoers (nginx reload) — 이미 등록되어 있어 추가 작업 불필요

`/etc/sudoers.d/starter-nginx`에 `claude ALL=(ALL) NOPASSWD: /usr/sbin/nginx -s reload`가 명령어 단위로
등록되어 있어 leader 배포 스크립트의 `sudo /usr/sbin/nginx -s reload`도 그대로 통과된다.

## 3. Git / GitHub — 완료됨

```bash
cd ~/leader
git init
git add .
git commit -m "Initial scaffold: web(13000)+was(13001), Nginx"
git branch -M main
gh repo create jjh1215/leader --public --source=. --remote=origin
git push -u origin main
```

## 4. 배포 확인 (2번 sudo 작업 완료 후)

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user status leader-backend --no-pager
systemctl --user status leader-runner --no-pager

curl -s http://127.0.0.1:13000/            # 프론트엔드 (200 기대)
curl -s http://127.0.0.1:13000/api/hello   # nginx → 백엔드 프록시 (JSON 기대)
curl -s http://127.0.0.1:13000/api/health  # {"status":"UP"} 기대

gh run list --repo jjh1215/leader --limit 5
gh api repos/jjh1215/leader/actions/runners --jq '.runners[] | {name, status, busy}'
```

## 참고

- `CLAUDE.md` — Claude Code가 이 저장소에서 작업할 때 자동으로 참고하는 요약 컨텍스트(제약사항,
  포트 규약). 이 문서(`DEPLOYMENT.md`)는 사람이 읽는 상세 런북이고, 서로 겹치는 내용이 있다.
