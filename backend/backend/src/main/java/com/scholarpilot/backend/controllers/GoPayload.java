package com.scholarpilot.backend.controllers;

import com.scholarpilot.backend.models.Scheme;
import lombok.Data;

import java.util.List;

@Data
public class GoPayload {
    private String job_id;
    private List<Scheme> schemes;
}
