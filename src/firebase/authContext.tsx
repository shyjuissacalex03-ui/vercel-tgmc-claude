import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  type User,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  updateProfile,
  signOut as firebaseSignOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "./config.ts";

// Only this email address has administrator access.
// Keep it in sync with firestore.rules and storage.rules.
export const ADMIN_EMAIL = "shyjuissacalex03@gmail.com";

export function isUserAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.toLowerCase().trim() === ADMIN_EMAIL.toLowerCase().trim();
}

/**
 * Administrator = the admin email AND that email is verified.
 * Without the verified check, anyone could register a password account using the
 * admin address (before the real owner does) and be treated as the administrator.
 * Google sign-in always counts as verified.
 */
export function isAdminUser(user?: Pick<User, "email" | "emailVerified"> | null): boolean {
  return !!user && user.emailVerified === true && isUserAdminEmail(user.email);
}

interface AuthContextType {
  currentUser: User | null;
  isAdmin: boolean;
  /** True when signed in with the admin email but the email has not been verified yet. */
  adminNeedsVerification: boolean;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, displayName: string) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  resendVerificationEmail: () => Promise<void>;
  /** Re-reads the account from Firebase (e.g. after clicking the verification link). */
  refreshUser: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isAdmin: false,
  adminNeedsVerification: false,
  loading: true,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => {},
  signUpWithEmail: async () => {},
  sendPasswordReset: async () => {},
  resendVerificationEmail: async () => {},
  refreshUser: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

/** Keeps a small profile document per member. Never blocks or breaks sign-in. */
async function syncUserProfile(user: User): Promise<void> {
  const admin = isAdminUser(user);
  const now = new Date().toISOString();

  try {
    const profileRef = doc(db, "users", user.uid);
    const existing = await getDoc(profileRef);
    await setDoc(
      profileRef,
      {
        userId: user.uid,
        displayName: user.displayName || user.email?.split("@")[0] || "TGMC Member",
        email: user.email || "",
        photoURL: user.photoURL || "",
        isAdmin: admin,
        role: admin ? "Administrator" : "Member",
        lastLoginAt: now,
        // Only stamp createdAt the first time, so it keeps the real join date.
        ...(existing.exists() && existing.data()?.createdAt ? {} : { createdAt: now }),
      },
      { merge: true }
    );

    if (admin) {
      const adminRef = doc(db, "admins", user.uid);
      const existingAdmin = await getDoc(adminRef);
      if (!existingAdmin.exists()) {
        await setDoc(adminRef, {
          uid: user.uid,
          email: user.email,
          role: "Super Admin",
          grantedAt: now,
        });
      }
    }
  } catch (err) {
    console.warn("Could not sync user profile:", err);
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  // Firebase mutates the same User object in place (displayName, emailVerified…),
  // so bump a counter to make React re-read it.
  const [userVersion, setUserVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setUserVersion((v) => v + 1);
      setLoading(false);
      if (user) void syncUserProfile(user);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    await signInWithPopup(auth, provider);
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    const name = displayName.trim();
    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }
    try {
      await sendEmailVerification(cred.user);
    } catch (err) {
      console.warn("Could not send verification email:", err);
    }
    // onAuthStateChanged fired before the name was set — refresh UI and stored profile.
    setUserVersion((v) => v + 1);
    void syncUserProfile(cred.user);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await sendPasswordResetEmail(auth, email.trim());
  }, []);

  const resendVerificationEmail = useCallback(async () => {
    if (!auth.currentUser) throw new Error("Please sign in first.");
    await sendEmailVerification(auth.currentUser);
  }, []);

  const refreshUser = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;
    await user.reload();
    // Force a fresh ID token so the security rules also see email_verified = true.
    await user.getIdToken(true);
    setCurrentUser(auth.currentUser);
    setUserVersion((v) => v + 1);
    if (auth.currentUser) void syncUserProfile(auth.currentUser);
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      currentUser,
      isAdmin: isAdminUser(currentUser),
      adminNeedsVerification:
        !!currentUser && isUserAdminEmail(currentUser.email) && !currentUser.emailVerified,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      sendPasswordReset,
      resendVerificationEmail,
      refreshUser,
      signOut,
    }),
    // userVersion is intentional: see comment above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentUser, userVersion, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, sendPasswordReset, resendVerificationEmail, refreshUser, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
