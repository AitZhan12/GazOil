package kz.azs.web;

/** Сущность не найдена — превращается в HTTP 404 в GlobalExceptionHandler. */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
