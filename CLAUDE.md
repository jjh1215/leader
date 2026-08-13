# leader — web/was 분리 구성

React(Vite) 프론트엔드 + Spring Boot 백엔드, 계정(claude) 전용 systemd + 시스템 Nginx로 구성된 프로젝트.

## 계정/권한 제약

- 로그인 계정은 `claude`이며 **sudo 권한이 전혀 없다.**
- sudo가 필요한 명령은 절대 직접 실행하지 말 것. 실행해야 할 정확한 명령어를 코드블록으로 보여주고, 이유를 한 줄로 설명한 뒤 "sudo 권한이 있는 다른 세션에서 실행한 뒤 완료되면 알려달라"고 말하고 멈출 것. 사용자가 "완료했어/실행했어"라고 답하기 전까지 다음 단계로 넘어가지 말 것.
- Java, Maven, Node, systemd(user) 서비스, GitHub Actions runner는 전부 `claude` 계정 안에 sudo 없이 설치되어 있다.
- Nginx만 시스템 패키지(sudo dnf install)로 이미 설치되어 있다 (starter/flash-coupon과 공용).
- **예외**: `sudo /usr/sbin/nginx -s reload`는 starter 프로젝트용으로 `/etc/sudoers.d/starter-nginx`에 NOPASSWD로 등록되어 있다. leader 배포 스크립트도 이 reload 명령을 사용하므로, sudoers 룰이 `/usr/sbin/nginx -s reload` 전체를 커버하는 한 leader에도 그대로 적용된다.

## 포트 / 아키텍처

```
브라우저 → Nginx :13000 → 정적 파일(React dist) 서빙
                        → /api/* 는 http://127.0.0.1:13001 (Spring Boot)로 프록시
```

- Web(Nginx): 13000
- WAS(Spring Boot): 13001
- 다른 프로젝트와의 포트 규약: starter=11000/11001, flash-coupon=12000/12001, leader=13000/13001.
- 방화벽(firewalld)에 13000/tcp를 개방해야 외부 접속이 가능하다 (아직 미개방 — sudo 필요). 13001은 nginx를 통해서만 접근(외부 미개방).

## 디렉토리 구조

```
~/leader/
├── backend/            Spring Boot(Maven, Java 21) — com.example.leader
│   └── src/main/java/com/example/leader/{LeaderApplication.java, controller/HelloController.java}
├── frontend/            React + Vite
│   ├── src/{App.jsx, main.jsx}, vite.config.js (dev server 13000, /api → 13001 프록시)
│   └── dist/            빌드 산출물 (nginx root, git 미추적)
├── deploy/
│   ├── leader-backend.service   systemd --user 서비스 (Spring Boot 실행)
│   ├── leader-runner.service    systemd --user 서비스 (GitHub Actions self-hosted runner)
│   └── nginx-leader.conf        /etc/nginx/conf.d/leader.conf 로 배포할 원본 (아직 미설치 — sudo 필요)
├── .github/workflows/deploy.yml  main push 시 자동 빌드+배포
├── app.jar               배포된 백엔드 jar (git 미추적, deploy가 덮어씀)
└── CLAUDE.md              이 파일
```

## 로컬 실행 환경

- Java/Maven: SDKMAN (`source ~/.sdkman/bin/sdkman-init.sh`), Java 21.0.4-tem
- Node: nvm, v22.23.2 (`~/.nvm/versions/node/v22.23.2/bin`)
- `systemctl --user ...` 명령을 쓸 때는 셸에 `XDG_RUNTIME_DIR`가 비어 있을 수 있으니 먼저 `export XDG_RUNTIME_DIR=/run/user/$(id -u)`를 실행할 것.

## systemd --user 서비스

| 서비스 | 역할 | 명령 |
|---|---|---|
| `leader-backend` | Spring Boot 실행 (`~/leader/app.jar`) | `systemctl --user restart leader-backend` |
| `leader-runner` | GitHub Actions self-hosted runner | `systemctl --user status leader-runner` |

두 서비스 모두 `loginctl enable-linger claude`가 이미 설정되어 있어(starter 구축 시 적용) 로그아웃 후에도 계속 실행된다.

## GitHub / CI-CD

- 저장소: `https://github.com/jjh1215/leader` (계정 jjh1215, `gh auth status`로 인증됨)
- **Self-hosted runner 사용** — 이 서버가 사설 IP만 가지고 있어 GitHub 클라우드 러너가 SSH로 직접 접속할 수 없다. 그래서 이 서버 자체가 러너로 등록되어 GitHub에 아웃바운드로만 연결된다. 작업 디렉토리는 `~/leader-actions-runner` (starter의 `~/actions-runner`, flash-coupon의 `~/flashcoupon-actions-runner`와 별도).
- `main` push 시 `.github/workflows/deploy.yml` 실행:
  1. `build-backend` / `build-frontend` 병렬 빌드 (jar, dist를 artifact로 업로드)
  2. `deploy`: jar를 `~/leader/app.jar`로 교체 후 `systemctl --user restart leader-backend`, frontend는 `dist_new`에 새로 받아서 atomic swap으로 `dist` 교체, `restorecon -Rv ~/leader/frontend/dist`로 SELinux 라벨 복구, 마지막에 `sudo /usr/sbin/nginx -s reload`
- Actions secrets는 **사용하지 않음** (self-hosted라 불필요).

## 알아둬야 할 함정 (starter/flash-coupon에서 이미 확인된 것들, leader에도 동일 적용)

- **nginx 바이너리 경로**: `/usr/bin/nginx`가 아니라 **`/usr/sbin/nginx`**.
- **SELinux 컨텍스트**: `semanage fcontext`로 `frontend/dist` 경로 패턴을 등록해야 하며, 배포 스크립트가 `dist_new`→`dist` `mv`로 swap하므로 매 배포마다 `restorecon -Rv ~/leader/frontend/dist`가 필요하다 (sudo 없이 claude 계정으로 가능 — 등록된 fcontext 규칙 범위 내 relabel). deploy.yml에 이미 반영되어 있다.
- **systemd --user 관련 명령은 `XDG_RUNTIME_DIR` 없이 실행하면 "Failed to connect to bus" 에러**가 난다. 항상 `export XDG_RUNTIME_DIR=/run/user/$(id -u)` 먼저 할 것.
- **`npm ci`를 쓰려면 `package-lock.json`이 git에 커밋되어 있어야 한다** (`.gitignore`에서 제외하지 말 것).
- runner의 systemd 서비스(`leader-runner.service`)는 비대화형 셸이라 `.bashrc`의 nvm/sdkman init이 로드되지 않는다. 그래서 서비스 파일 자체에 `Environment=PATH=...`로 java/maven/node 경로를 명시해뒀다.

## 배포 확인 방법

```bash
export XDG_RUNTIME_DIR=/run/user/$(id -u)
systemctl --user status leader-backend --no-pager
curl -s http://127.0.0.1:13001/api/hello  # 백엔드 직접 확인
curl -s http://127.0.0.1:13000/           # nginx 배포 후 프론트 200 확인
curl -s http://127.0.0.1:13000/api/hello  # nginx 배포 후 백엔드 프록시 확인
gh run list --repo jjh1215/leader --limit 5
```
