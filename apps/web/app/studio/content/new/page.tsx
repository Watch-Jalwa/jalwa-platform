import { createContentDraftAction, importYouTubeAction } from "@/app/studio/actions";
import { getCategories } from "@/lib/catalogue/repository";

export const metadata = { title: "Add content" };
export const dynamic = "force-dynamic";
type SearchParams = Promise<{ error?: string }>;

export default async function NewContentPage({ searchParams }: { searchParams: SearchParams }) {
  const [{ error }, categories] = await Promise.all([searchParams, getCategories()]);
  return (
    <div>
      <div className="section-heading"><div><span className="eyebrow">Ingestion</span><h1>Add content</h1></div></div>
      {error ? <p className="form-message">{error}</p> : null}
      <div className="studio-grid">
        <form className="panel" action={importYouTubeAction}>
          <span className="eyebrow">Official embed</span><h2>Import YouTube video</h2>
          <p>Creates a draft using YouTube’s official player. It does not download the video.</p>
          <label className="form-field"><span>YouTube URL</span><input name="url" placeholder="https://www.youtube.com/watch?v=..." required /></label>
          <label className="form-field"><span>Category</span><select name="category"><option value="">Choose later</option>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
          <button className="button button-primary" type="submit">Import as draft</button>
        </form>

        <form className="panel" action={createContentDraftAction}>
          <span className="eyebrow">Manual draft</span><h2>Create Jalwa content</h2>
          <label className="form-field"><span>English title</span><input name="title" required /></label>
          <label className="form-field"><span>Urdu title</span><input dir="rtl" name="titleUrdu" /></label>
          <label className="form-field"><span>Category</span><select name="category" required>{categories.map((category) => <option key={category.slug} value={category.slug}>{category.label}</option>)}</select></label>
          <label className="form-field"><span>Type</span><select name="contentType"><option value="video">Video</option><option value="short">Short</option><option value="article">Article</option><option value="image_story">Image story</option><option value="audio">Audio</option><option value="quiz">Quiz</option></select></label>
          <label className="form-field"><span>Hosting</span><select name="hostingMode"><option value="self_host_owned">Jalwa-owned</option><option value="self_host_open">Open-license self-hosted</option><option value="external_link">External link</option><option value="text_database">Text database</option></select></label>
          <button className="button button-primary" type="submit">Create draft</button>
        </form>
      </div>
    </div>
  );
}
