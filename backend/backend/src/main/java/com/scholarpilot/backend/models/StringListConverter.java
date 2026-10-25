package com.scholarpilot.backend.models;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.Arrays;
import java.util.List;

@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {
    @Override
    public String convertToDatabaseColumn(List<String> list) {
        return list == null ? null : String.join(",", list);
    }

    @Override
    public List<String> convertToEntityAttribute(String joined) {
        return joined == null ? null : Arrays.asList(joined.split(","));
    }
}