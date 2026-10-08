import React, { useEffect, useState } from "react";
import { useAuth } from "../firebase/authContext.tsx";
import {
  subscribeUserPrayerRequests,
  subscribeUserRSVPs,
} from "../firebase/firestoreService.ts";
import { X, Heart, Calendar, CheckCircle, LogOut, Edit3, AlertCircle, Loader2 } from "lucide-react";

const formatDate = (value: unknown) => {
  const date = new Date(String(value ?? ""));
  return Number.isNaN(date.getTime()) ? "recently" : date.toLocaleDateString("en-GB");
};

interface MySubmissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenEditor?: () => void;
}

export const MySubmissionsModal: React.FC<MySubmissionsModalProps> = ({
  isOpen,
  onClose,
  onOpenEditor,
}) => {
  const { currentUser, signOut, isAdmin, adminNeedsVerification, resendVerificationEmail, refreshUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"prayers" | "rsvps">("prayers");
  const [prayers, setPrayers] = useState<any[]>([]);
  const [rsvps, setRsvps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const userId = currentUser?.uid;

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setLoadError(false);
    setVerifyMsg(null);
    // Never show the previous member's items while the new ones load.
    setPrayers([]);
    setRsvps([]);

    const unsubPrayers = subscribeUserPrayerRequests(
      userId,
      (data) => {
        setPrayers(data);
        setLoading(false);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      }
    );

    const unsubRsvps = subscribeUserRSVPs(
      userId,
      (data) => {
        setRsvps(data);
      },
      () => setLoadError(true)
    );

    return () => {
      unsubPrayers();
      unsubRsvps();
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const handleResendVerification = async () => {
    setVerifyBusy(true);
    setVerifyMsg(null);
    try {
      await resendVerificationEmail();
      setVerifyMsg("Verification email sent. Open the link in it, then press “I've verified”.");
    } catch (err) {
      console.error("Resend verification failed:", err);
      setVerifyMsg("Could not send the email just now. Please wait a minute and try again.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleCheckVerification = async () => {
    setVerifyBusy(true);
    setVerifyMsg(null);
    try {
      await refreshUser();
      // When verified, isAdmin flips to true and this banner disappears.
      setVerifyMsg("Still not verified. Please open the link in the verification email first.");
    } catch (err) {
      console.error("Refresh user failed:", err);
      setVerifyMsg("Could not check right now. Please try again.");
    } finally {
      setVerifyBusy(false);
    }
  };

  if (!isOpen || !currentUser) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My account"
        className="relative max-w-2xl w-full bg-white rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[85vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex flex-wrap justify-between items-center gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-3 min-w-0">
            {currentUser.photoURL ? (
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName || "User"}
                referrerPolicy="no-referrer"
                className="w-10 h-10 rounded-full border border-slate-300 shrink-0"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[#478226] text-white flex items-center justify-center font-bold shrink-0">
                {(currentUser.displayName || currentUser.email || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-bold text-base text-[#282f3b] truncate">
                {currentUser.displayName || "Member"}
              </h3>
              <p className="text-xs text-slate-500 truncate">{currentUser.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isAdmin && onOpenEditor && (
              <button
                onClick={onOpenEditor}
                className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#478226] hover:bg-[#39691e] flex items-center gap-1.5 shadow-sm transition-all"
                title="Edit Website Content and Images"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#ecb029]" />
                <span>Edit Site Content</span>
              </button>
            )}
            <button
              onClick={() => {
                signOut().catch((err) => console.error("Sign-out failed:", err));
                onClose();
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 border border-rose-200 flex items-center gap-1 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admin email signed in with a password but not verified yet */}
        {adminNeedsVerification && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
            <p className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>Verify your email to unlock the admin tools.</strong> For security, the site editor only opens
                once this email address is verified. Signing in with Google also works straight away.
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-2 pl-6">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={verifyBusy}
                className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 font-bold hover:bg-amber-100 disabled:opacity-60"
              >
                Send verification email
              </button>
              <button
                type="button"
                onClick={handleCheckVerification}
                disabled={verifyBusy}
                className="px-3 py-1.5 rounded-lg bg-amber-500 text-white font-bold hover:bg-amber-600 disabled:opacity-60"
              >
                I've verified
              </button>
              {verifyBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            </div>
            {verifyMsg && <p className="pl-6">{verifyMsg}</p>}
          </div>
        )}

        {loadError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
            <span>We could not load your submissions right now. Please check your connection and try again later.</span>
          </div>
        )}

        {/* Tab switch */}
        <div className="flex p-1 bg-[#f0f3f9] rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab("prayers")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "prayers"
                ? "bg-[#478226] text-white shadow"
                : "text-slate-600 hover:text-[#282f3b]"
            }`}
          >
            <Heart className="w-3.5 h-3.5" />
            <span>My Prayer Requests ({prayers.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("rsvps")}
            className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              activeTab === "rsvps"
                ? "bg-[#478226] text-white shadow"
                : "text-slate-600 hover:text-[#282f3b]"
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>My Event RSVPs ({rsvps.length})</span>
          </button>
        </div>

        {/* Content list */}
        <div className="overflow-y-auto space-y-3 flex-1 pr-1">
          {loading && !loadError ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <Loader2 className="w-6 h-6 text-slate-300 mx-auto mb-2 animate-spin" />
              <p>Loading your submissions…</p>
            </div>
          ) : activeTab === "prayers" ? (
            prayers.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">
                <Heart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p>No prayer requests submitted yet.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Submit a petition on the Home or Contact page.
                </p>
              </div>
            ) : (
              prayers.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-[#f0f3f9] border border-slate-200 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#282f3b]">{item.subject}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#478226]/10 text-[#478226] border border-[#478226]/20">
                      {item.status === "prayed" ? "Prayed Over" : "Active Petition"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{item.message}</p>
                  <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>Submitted {formatDate(item.createdAt)}</span>
                    <span>{item.isPrivate ? "Private to Pastoral Team" : "Public"}</span>
                  </div>
                </div>
              ))
            )
          ) : rsvps.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p>No event RSVPs registered yet.</p>
              <p className="text-[11px] text-slate-400 mt-1">
                Explore our upcoming gatherings on the Events page.
              </p>
            </div>
          ) : (
            rsvps.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-[#f0f3f9] border border-slate-200 space-y-1.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#282f3b]">{item.eventTitle}</span>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                    <CheckCircle className="w-3 h-3" /> Confirmed
                  </span>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-3">
                  <span>Attendees: {item.attendees}</span>
                  <span>·</span>
                  <span>Registered: {formatDate(item.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MySubmissionsModal;
