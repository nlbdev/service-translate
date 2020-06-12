interface GoogleRequest {
    parent: string;
    contents: string[];
    mimeType: string;
    sourceLanguageCode: string;
    targetLanguageCode: string;
    model?: string | undefined;
}
