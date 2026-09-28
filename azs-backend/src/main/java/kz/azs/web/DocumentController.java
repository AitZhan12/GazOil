package kz.azs.web;

import com.fasterxml.jackson.databind.JsonNode;
import kz.azs.service.AuthService;
import kz.azs.service.DocumentAiService;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/documents")
public class DocumentController {
    private final DocumentAiService ai;
    private final AuthService auth;

    public DocumentController(DocumentAiService ai, AuthService auth) {
        this.ai = ai;
        this.auth = auth;
    }

    @PostMapping(value = "/parse", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public JsonNode parse(@RequestPart("file") MultipartFile file) {
        auth.currentUser();
        if (file.isEmpty()) throw new IllegalArgumentException("Файл не выбран");
        if (file.getSize() > 15 * 1024 * 1024) throw new IllegalArgumentException("Файл больше 15 МБ");
        return ai.parse(file);
    }
}
