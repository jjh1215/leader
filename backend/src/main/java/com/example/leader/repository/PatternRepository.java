package com.example.leader.repository;

import com.example.leader.entity.PatternEntity;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PatternRepository extends JpaRepository<PatternEntity, Long> {
}
