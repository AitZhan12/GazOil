package kz.azs.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.Base64;

@Service
public class DocumentAiService {
    private final ObjectMapper mapper;
    private final String apiUrl;
    private final String apiKey;
    private final String model;
    private final String provider;
    private final HttpClient http = HttpClient.newHttpClient();

    public DocumentAiService(ObjectMapper mapper,
                             @Value("${ai.api-url:https://api.anthropic.com/v1/messages}") String apiUrl,
                             @Value("${ai.api-key:}") String apiKey,
                             @Value("${ai.model:}") String model,
                             @Value("${ai.provider:auto}") String provider) {
        this.mapper = mapper;
        this.apiUrl = apiUrl;
        this.apiKey = apiKey;
        this.provider = provider;
        boolean openAi = isOpenAi();
        this.model = model.isBlank() ? (openAi ? "gpt-4o" : "claude-3-5-sonnet-latest") : model;
    }

    public JsonNode parse(MultipartFile file) {
        if (apiKey.isBlank()) {
            throw new IllegalStateException("ИИ не настроен: укажите AI_API_KEY");
        }
        try {
            String mediaType = file.getContentType() != null ? file.getContentType() : "image/jpeg";
            boolean openAi = isOpenAi();
            if (openAi) return parseWithOpenAi(file, mediaType);
            String kind = mediaType.equals("application/pdf") ? "document" : "image";

            ObjectNode source = mapper.createObjectNode()
                    .put("type", "base64")
                    .put("media_type", mediaType)
                    .put("data", Base64.getEncoder().encodeToString(file.getBytes()));
            ObjectNode visual = mapper.createObjectNode().put("type", kind).set("source", source);

            ArrayNode content = mapper.createArrayNode().add(visual);
            content.add(mapper.createObjectNode().put("type", "text").put("text", prompt()));
            ObjectNode body = mapper.createObjectNode()
                    .put("model", model).put("max_tokens", 1800).set("messages", mapper.createArrayNode()
                            .add(mapper.createObjectNode().put("role", "user").set("content", content)));

            HttpRequest request = HttpRequest.newBuilder(URI.create(apiUrl))
                    .header("Content-Type", "application/json")
                    .header("x-api-key", apiKey)
                    .header("anthropic-version", "2023-06-01")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) {
                throw new IllegalStateException("Ошибка ИИ (" + response.statusCode() + ")");
            }
            JsonNode responseJson = mapper.readTree(response.body());
            String text = responseJson.path("content").findValue("text").asText();
            String json = text.replaceFirst("^```json\\s*", "").replaceFirst("^```\\s*", "").replaceFirst("\\s*```$", "").trim();
            return mapper.readTree(json);
        } catch (Exception e) {
            if (e instanceof IllegalStateException state) throw state;
            throw new IllegalStateException("Не удалось распознать документ", e);
        }
    }

    private JsonNode parseWithOpenAi(MultipartFile file, String mediaType) throws Exception {
        if (mediaType.equals("application/pdf")) {
            throw new IllegalArgumentException("Для OpenAI сейчас загрузите фото отчета, а не PDF");
        }
        String dataUrl = "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(file.getBytes());
        ObjectNode image = mapper.createObjectNode().put("type", "image_url")
                .set("image_url", mapper.createObjectNode().put("url", dataUrl));
        ArrayNode content = mapper.createArrayNode()
                .add(mapper.createObjectNode().put("type", "text").put("text", prompt()))
                .add(image);
        ObjectNode body = mapper.createObjectNode().put("model", model).put("temperature", 0)
                .set("messages", mapper.createArrayNode().add(mapper.createObjectNode()
                        .put("role", "user").set("content", content)));
        HttpRequest request = HttpRequest.newBuilder(URI.create(
                        apiUrl.contains("anthropic.com") ? "https://api.openai.com/v1/chat/completions" : apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)))
                .build();
        HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() / 100 != 2) throw new IllegalStateException("Ошибка OpenAI (" + response.statusCode() + ")");
        JsonNode responseJson = mapper.readTree(response.body());
        String text = responseJson.path("choices").path(0).path("message").path("content").asText();
        String json = text.replaceFirst("^```json\\s*", "").replaceFirst("^```\\s*", "").replaceFirst("\\s*```$", "").trim();
        return mapper.readTree(json);
    }

    private boolean isOpenAi() {
        return "openai".equalsIgnoreCase(provider)
                || apiKey.startsWith("sk-proj-")
                || (apiKey.startsWith("sk-") && !apiKey.startsWith("sk-ant-"));
    }

    private static String prompt() {
        return "Ты распознаешь отчет смены АЗС на русском языке. Верни только JSON без markdown. " +
                "Поля: operatorName, startDate (YYYY-MM-DD), startTime (HH:MM), endDate, endTime, " +
                "shiftType (full/day/night), pumps (массив объектов pumpNumber,start,end), voucherLiters, " +
                "cardLiters, discountLiters, kaspiQR, kaspiTransfer, halykQR, halykTransfer. " +
                "Если поле не видно, используй 0 для чисел и пустую строку для текста. Не выдумывай значения.";
    }
}
