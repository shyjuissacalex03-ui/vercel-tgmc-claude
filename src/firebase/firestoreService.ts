import { collection, doc, setDoc, query, where, onSnapshot } from "firebase/firestore";
import { db, auth } from "./config.ts";
import { FirestoreOperationError, handleFirestoreError, OperationType } from "./errorHandler.ts";

export interface PrayerRequestPayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  isPrivate?: boolean;
}

export interface ContactMessagePayload {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
}

export interface EventRSVPPayload {
  eventId: string;
  eventTitle: string;
  name: string;
  email: string;
  attendees: string;
}

// These limits mirror firestore.rules. Checking them here means visitors get a clear
// message instead of a "permission denied" from the database.
export const LIMITS = {
  name: 100,
  emailMin: 5,
  email: 150,
  phone: 30,
  subject: 150,
  messageMin: 5,
  message: 3000,
  eventTitle: 200,
} as const;

/** Thrown when what the visitor typed cannot be accepted. `message` is shown to them as-is. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

/** The sentence to show a visitor when a contact / prayer / RSVP submission fails. */
export function getSubmissionErrorMessage(err: unknown): string {
  if (err instanceof ValidationError) return err.message;
  if (err instanceof FirestoreOperationError && (err.code === "unavailable" || err.code === "deadline-exceeded")) {
    return err.message;
  }
  return "Sorry, we could not send this right now. Please try again in a moment, or contact us by phone or email.";
}

const clean = (value: string | undefined | null, max: number) => (value ?? "").trim().slice(0, max);

function validName(raw: string): string {
  const name = raw.trim();
  if (!name) throw new ValidationError("Please enter your name.");
  if (name.length > LIMITS.name) throw new ValidationError(`Please keep your name under ${LIMITS.name} characters.`);
  return name;
}

function validEmail(raw: string): string {
  const email = raw.trim();
  if (email.length < LIMITS.emailMin || email.length > LIMITS.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ValidationError("Please enter a valid email address.");
  }
  return email;
}

function validMessage(raw: string): string {
  const message = raw.trim();
  if (message.length < LIMITS.messageMin) {
    throw new ValidationError("Please write a little more in your message (at least 5 characters).");
  }
  if (message.length > LIMITS.message) {
    throw new ValidationError(`Your message is too long. Please keep it under ${LIMITS.message} characters.`);
  }
  return message;
}

const newId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

// 1. Submit Prayer Request
export async function submitPrayerRequest(payload: PrayerRequestPayload): Promise<string> {
  const collectionPath = "prayerRequests";
  const id = newId("req");

  const data = {
    id,
    name: validName(payload.name),
    email: validEmail(payload.email),
    phone: clean(payload.phone, LIMITS.phone),
    subject: clean(payload.subject, LIMITS.subject) || "Prayer Petition",
    message: validMessage(payload.message),
    isPrivate: payload.isPrivate ?? true,
    status: "pending",
    userId: auth.currentUser ? auth.currentUser.uid : null,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, collectionPath, id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${collectionPath}/${id}`);
  }
}

// 2. Submit Contact Message
export async function submitContactMessage(payload: ContactMessagePayload): Promise<string> {
  const collectionPath = "contactMessages";
  const id = newId("msg");

  const data = {
    id,
    name: validName(payload.name),
    email: validEmail(payload.email),
    phone: clean(payload.phone, LIMITS.phone),
    subject: clean(payload.subject, LIMITS.subject) || "General Enquiry",
    message: validMessage(payload.message),
    status: "unread",
    userId: auth.currentUser ? auth.currentUser.uid : null,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, collectionPath, id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${collectionPath}/${id}`);
  }
}

// 3. Submit Event RSVP
export async function submitEventRSVP(payload: EventRSVPPayload): Promise<string> {
  const collectionPath = "eventRsvps";
  const id = newId("rsvp");

  const data = {
    id,
    eventId: clean(payload.eventId, 128),
    eventTitle: clean(payload.eventTitle, LIMITS.eventTitle),
    name: validName(payload.name),
    email: validEmail(payload.email),
    attendees: clean(payload.attendees, 10) || "1",
    userId: auth.currentUser ? auth.currentUser.uid : null,
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(doc(db, collectionPath, id), data);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `${collectionPath}/${id}`);
  }
}

const newestFirst = (a: any, b: any) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""));

function subscribeToOwnDocuments(
  collectionPath: string,
  userId: string,
  onData: (data: any[]) => void,
  onError?: (err: unknown) => void
) {
  const q = query(collection(db, collectionPath), where("userId", "==", userId));

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((d) => d.data()).sort(newestFirst));
    },
    (error) => {
      // Never throw from a listener callback — that becomes an uncaught error in the browser.
      console.error(`Firestore listener error on ${collectionPath}:`, error);
      if (onError) onError(error);
    }
  );
}

// 4. Subscribe to the signed-in user's prayer requests (newest first)
export function subscribeUserPrayerRequests(
  userId: string,
  onData: (data: any[]) => void,
  onError?: (err: unknown) => void
) {
  return subscribeToOwnDocuments("prayerRequests", userId, onData, onError);
}

// 5. Subscribe to the signed-in user's RSVPs (newest first)
export function subscribeUserRSVPs(
  userId: string,
  onData: (data: any[]) => void,
  onError?: (err: unknown) => void
) {
  return subscribeToOwnDocuments("eventRsvps", userId, onData, onError);
}
