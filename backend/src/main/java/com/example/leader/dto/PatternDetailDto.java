package com.example.leader.dto;

import com.fasterxml.jackson.databind.JsonNode;

import java.time.Instant;

public record PatternDetailDto(
        Long id,
        String name,
        Instant createdAt,
        Instant updatedAt,
        int schemaVersion,
        JsonNode content
) {
}
