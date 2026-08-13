package com.example.leader.service;

import com.example.leader.dto.PatternDetailDto;
import com.example.leader.dto.PatternRequest;
import com.example.leader.dto.PatternSummaryDto;
import com.example.leader.entity.PatternEntity;
import com.example.leader.exception.NotFoundException;
import com.example.leader.repository.PatternRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class PatternService {

    private static final int CURRENT_SCHEMA_VERSION = 1;

    private final PatternRepository repository;
    private final ObjectMapper objectMapper;

    public PatternService(PatternRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    public List<PatternSummaryDto> list() {
        return repository.findAll().stream()
                .map(e -> new PatternSummaryDto(e.getId(), e.getName(), e.getCreatedAt(), e.getUpdatedAt()))
                .toList();
    }

    public PatternDetailDto get(Long id) {
        return toDetailDto(find(id));
    }

    public PatternDetailDto create(PatternRequest request) {
        Instant now = Instant.now();
        PatternEntity entity = new PatternEntity();
        entity.setName(request.name());
        entity.setContent(writeContent(request.content()));
        entity.setSchemaVersion(CURRENT_SCHEMA_VERSION);
        entity.setCreatedAt(now);
        entity.setUpdatedAt(now);
        return toDetailDto(repository.save(entity));
    }

    public PatternDetailDto update(Long id, PatternRequest request) {
        PatternEntity entity = find(id);
        entity.setName(request.name());
        entity.setContent(writeContent(request.content()));
        entity.setUpdatedAt(Instant.now());
        return toDetailDto(repository.save(entity));
    }

    public void delete(Long id) {
        if (!repository.existsById(id)) {
            throw new NotFoundException("Pattern not found: " + id);
        }
        repository.deleteById(id);
    }

    private PatternEntity find(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new NotFoundException("Pattern not found: " + id));
    }

    private PatternDetailDto toDetailDto(PatternEntity entity) {
        return new PatternDetailDto(
                entity.getId(),
                entity.getName(),
                entity.getCreatedAt(),
                entity.getUpdatedAt(),
                entity.getSchemaVersion(),
                readContent(entity.getContent())
        );
    }

    private String writeContent(JsonNode content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw new IllegalArgumentException("Invalid pattern content", e);
        }
    }

    private JsonNode readContent(String content) {
        try {
            return objectMapper.readTree(content);
        } catch (Exception e) {
            throw new IllegalStateException("Corrupt pattern content in storage", e);
        }
    }
}
