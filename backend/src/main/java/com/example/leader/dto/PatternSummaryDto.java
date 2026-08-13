package com.example.leader.dto;

import java.time.Instant;

public record PatternSummaryDto(
        Long id,
        String name,
        Instant createdAt,
        Instant updatedAt
) {
}
