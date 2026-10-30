import { Queue } from "bullmq";
export const OCR_QUEUE = Symbol("OCR_QUEUE");
export const OCR_QUEUE_NAME = "godt-ocr";
export type OcrQueue = Queue;
