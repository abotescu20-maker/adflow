"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { doc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { UserProfile } from "@/lib/schema";

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, (fbUser) => {
      // Clean up previous profile listener
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }

      setUser(fbUser);
      if (!fbUser) {
        setProfile(null);
        setLoading(false);
        return;
      }

      const profileRef = doc(db, "users", fbUser.uid);

      profileUnsub = onSnapshot(
        profileRef,
        async (snap) => {
          if (snap.exists()) {
            setProfile(snap.data() as UserProfile);
            setLoading(false);
          } else {
            // First-time profile creation with merge
            try {
              await setDoc(
                profileRef,
                {
                  uid: fbUser.uid,
                  email: fbUser.email || "",
                  displayName:
                    fbUser.displayName || fbUser.email?.split("@")[0] || "User",
                  photoURL: fbUser.photoURL || null,
                  workspaces: [],
                  createdAt: serverTimestamp(),
                  lastActiveAt: serverTimestamp(),
                },
                { merge: true }
              );
              // Listener will fire again with the new doc
            } catch (err) {
              console.error("Failed to create user profile:", err);
              setLoading(false);
            }
          }
        },
        (err) => {
          console.error("Profile subscription error:", err);
          setLoading(false);
        }
      );
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  const signUp = async (email: string, password: string, displayName: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName });
  };

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, signUp, signIn, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
