import type { Provider } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

function requireClient() {
  if (!supabase) {
    throw new Error('Connect Supabase in your environment before using a live account.');
  }
  return supabase;
}

export const auth = {
  async signUp(email: string, password: string, fullName: string, emailRedirectTo: string) {
    const client = requireClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo },
    });
    if (error) throw error;
    return data;
  },

  async signInWithPassword(email: string, password: string) {
    const { data, error } = await requireClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  async resendEmailConfirmation(email: string, emailRedirectTo: string) {
    const { error } = await requireClient().auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo },
    });
    if (error) throw error;
  },

  async signInWithProvider(provider: Extract<Provider, 'google' | 'apple'>, redirectTo: string) {
    const { data, error } = await requireClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) throw error;
    return data.url;
  },

  async resetPassword(email: string) {
    const { error } = await requireClient().auth.resetPasswordForEmail(email, {
      redirectTo: 'mentra://auth/reset-password',
    });
    if (error) throw error;
  },

  async updateProfile({ fullName, school, country, subjects, subjectDescriptions }: { fullName: string; school: string; country: string; subjects?: string[]; subjectDescriptions?: Record<string, string> }) {
    const { data, error } = await requireClient().auth.updateUser({
      data: { full_name: fullName, school, country, ...(subjects ? { subjects } : {}), ...(subjectDescriptions ? { subject_descriptions: subjectDescriptions } : {}) },
    });
    if (error) throw error;
    return data;
  },

  async completeOnboarding({
    fullName,
    country,
    ageBand,
    educationLevel,
    classLevel,
    subjects,
    subjectDescriptions,
  }: {
    fullName: string;
    country: string;
    ageBand: string;
    educationLevel: string;
    classLevel: string;
    subjects: string[];
    subjectDescriptions?: Record<string, string>;
  }) {
    const { data, error } = await requireClient().auth.updateUser({
      data: {
        full_name: fullName,
        country,
        age_band: ageBand,
        education_level: educationLevel,
        class_level: classLevel,
        subjects,
        ...(subjectDescriptions ? { subject_descriptions: subjectDescriptions } : {}),
        onboarding_completed: true,
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await requireClient().auth.signOut();
    if (error) throw error;
  },
};
