export type Trophee = {
  id: string;
  title?: string | null;
  condition?: string | null;
  description_fun?: string | null;
  status: "unlocked" | "in_progress" | "secret" | string;
  progress?: number | null;
  current?: number | null;
  goal?: number | null;
  unlocked_at?: string | null;
  trophee_type: "social" | "profil" | string;
};

export type TropheeUnlockedPayload = {
  id: string;
  title: string;
  toast: string;
  tropheeType?: "social" | "profil" | string;
  unlockedAt?: string;
};
