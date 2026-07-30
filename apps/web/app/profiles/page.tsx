import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig, isFrontendPreview } from "@/lib/runtime";
import { createViewerProfile, deleteViewerProfile, selectViewerProfile } from "./actions";

export const metadata = { title: "Viewer profiles" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const demoProfiles = [
  { id: "demo-main", name: "Waseem", profile_type: "adult", avatar_key: "spark", preferred_language: "en", kids_mode: false, is_default: true },
  { id: "demo-kids", name: "Kids", profile_type: "child", avatar_key: "kite", preferred_language: "ur", kids_mode: true, is_default: false },
];

export default async function ProfilesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = isFrontendPreview() || !hasSupabaseConfig();
  let profiles = demoProfiles;
  let activeId = "demo-main";
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/profiles");
    const { data } = await supabase.from("viewer_profiles").select("id,name,profile_type,avatar_key,preferred_language,kids_mode,is_default").eq("user_id", user.id).order("is_default", { ascending: false }).order("created_at");
    profiles = data ?? [];
    activeId = (await cookies()).get(ACTIVE_PROFILE_COOKIE)?.value ?? profiles.find((profile) => profile.is_default)?.id ?? "";
  }

  return (
    <div className="page-shell viewer-page">
      <div className="section-heading"><div><span className="eyebrow">Family viewing</span><h1>Who is watching?</h1><p>Each profile keeps separate history, language and kids-mode settings.</p></div></div>
      {params.error ? <p className="policy-notice">{params.error === "limit" ? "An account can have up to five profiles." : "That change could not be saved."}</p> : null}
      <div className="viewer-grid">{profiles.map((profile) => <article className={`viewer-card ${activeId === profile.id ? "active" : ""}`} key={profile.id}><div className={`viewer-avatar avatar-${profile.avatar_key}`}>{profile.name.slice(0,1).toUpperCase()}</div><h2>{profile.name}</h2><p>{profile.kids_mode ? "Kids mode" : profile.profile_type} · {profile.preferred_language}</p><form action={selectViewerProfile}><input name="profileId" type="hidden" value={profile.id} /><button className="button button-primary" type="submit" disabled={preview || activeId === profile.id}>{activeId === profile.id ? "Active" : "Use profile"}</button></form>{!profile.is_default ? <form action={deleteViewerProfile}><input name="profileId" type="hidden" value={profile.id} /><button className="text-button" type="submit" disabled={preview}>Remove</button></form> : null}</article>)}</div>
      <form className="form-shell profile-create" action={createViewerProfile}><h2>Add a viewer</h2><label className="form-field"><span>Name</span><input name="name" required maxLength={40} /></label><div className="form-row"><label className="form-field"><span>Profile type</span><select name="profileType"><option value="adult">Adult</option><option value="teen">Teen</option><option value="child">Child / Kids</option></select></label><label className="form-field"><span>Avatar</span><select name="avatarKey"><option value="spark">Spark</option><option value="moon">Moon</option><option value="leaf">Leaf</option><option value="kite">Kite</option><option value="star">Star</option><option value="book">Book</option></select></label></div><label className="form-field"><span>Language</span><select name="preferredLanguage"><option value="en">English</option><option value="ur">اردو</option><option value="roman_ur">Roman Urdu</option></select></label><button className="button button-secondary" type="submit" disabled={preview}>Add profile</button>{preview ? <small>Preview mode shows the complete UI without writing account data.</small> : null}</form>
    </div>
  );
}
