package com.example.leader.controller;

import com.example.leader.dto.PatternDetailDto;
import com.example.leader.dto.PatternRequest;
import com.example.leader.dto.PatternSummaryDto;
import com.example.leader.service.PatternService;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
public class PatternController {

    private final PatternService service;

    public PatternController(PatternService service) {
        this.service = service;
    }

    @GetMapping("/api/patterns")
    public List<PatternSummaryDto> list() {
        return service.list();
    }

    @GetMapping("/api/patterns/{id}")
    public PatternDetailDto get(@PathVariable Long id) {
        return service.get(id);
    }

    @PostMapping("/api/patterns")
    @ResponseStatus(HttpStatus.CREATED)
    public PatternDetailDto create(@RequestBody PatternRequest request) {
        return service.create(request);
    }

    @PutMapping("/api/patterns/{id}")
    public PatternDetailDto update(@PathVariable Long id, @RequestBody PatternRequest request) {
        return service.update(id, request);
    }

    @DeleteMapping("/api/patterns/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
