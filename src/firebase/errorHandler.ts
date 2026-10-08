import { auth } from "./config.ts";

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

/** Error thrown to the UI. `message` is always safe and readable for visitors. */
export class FirestoreOperationError extends Error {
  code: string;
  operationType: OperationType;
  path: string | null;

  constructor(message: string, code: string, operationType: OperationType, path: string | null) {
    super(message);
    this.name = "FirestoreOperationError";
    this.code = code;
    this.operationType = operationType;
    this.path = path;
  }
}

function getErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String((error as { code: unknown }).code).replace(/^firestore\//, "");
  }
  return "unknown";
}

/** Turns a Firebase error into a short sentence a visitor can act on. */
export function describeFirestoreError(error: unknown): string {
  switch (getErrorCode(error)) {
    case "permission-denied":
      return "You do not have permission to do this. If you are the administrator, sign in again and check the Firestore security rules are deployed.";
    case "unauthenticated":
      return "Please sign in and try again.";
    case "unavailable":
    case "deadline-exceeded":
      return "We could not reach the database. Please check your internet connection and try again.";
    case "resource-exhausted":
      return "The service is busy right now. Please try again in a little while.";
    case "invalid-argument":
      return "Some of the information could not be saved. Please check what you entered and try again.";
    case "not-found":
      return "The database could not be found. Please contact the church office.";
    default:
      return "Something went wrong while saving. Please try again.";
  }
}

/** Logs full diagnostic detail to the console (for the developer) and throws a readable error (for the UI). */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const user = auth.currentUser;
  console.error("Firestore error", {
    code: getErrorCode(error),
    message: error instanceof Error ? error.message : String(error),
    operationType,
    path,
    auth: user
      ? { uid: user.uid, emailVerified: user.emailVerified, providers: user.providerData.map((p) => p.providerId) }
      : null,
  });

  throw new FirestoreOperationError(describeFirestoreError(error), getErrorCode(error), operationType, path);
}
