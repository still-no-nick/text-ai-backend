import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";

export type DomainErrorCode =
  | "VALIDATION_FAILED"
  | "UNSUPPORTED_AUDIO"
  | "PROVIDER_STT_FAILED"
  | "POST_PROCESS_FAILED"
  | "NOT_FOUND"
  | "INTERNAL";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(input: {
    code: DomainErrorCode;
    message: string;
    statusCode: number;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "DomainError";
    this.code = input.code;
    this.statusCode = input.statusCode;
    this.retryable = input.retryable ?? false;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    (this as { cause?: unknown }).cause = input.cause;
  }
}

export function registerErrorHandler(app: {
  setErrorHandler: (handler: (err: FastifyError, req: FastifyRequest, reply: FastifyReply) => void) => void;
}) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof DomainError) {
      void reply.status(err.statusCode).send({
        error: {
          code: err.code,
          message: err.message,
          retryable: err.retryable
        }
      });
      return;
    }

    // Fastify schema validation errors
    if ((err as { validation?: unknown }).validation) {
      void reply.status(400).send({
        error: {
          code: "VALIDATION_FAILED",
          message: "Invalid request",
          retryable: false
        }
      });
      return;
    }

    reply.log.error({ err }, "Unhandled error");
    void reply.status(500).send({
      error: {
        code: "INTERNAL",
        message: "Internal Server Error",
        retryable: false
      }
    });
  });
}

