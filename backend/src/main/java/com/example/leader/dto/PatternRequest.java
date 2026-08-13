package com.example.leader.dto;

import com.fasterxml.jackson.databind.JsonNode;

public record PatternRequest(
        String name,
        JsonNode content
) {
}
