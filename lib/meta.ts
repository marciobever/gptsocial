const API_VERSION = "v20.0";
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

type MetaError = {
  message?: string;
  error_user_msg?: string;
  code?: number;
  error_subcode?: number;
  fbtrace_id?: string;
};

export type AdAccount = { id: string; name: string; currency?: string; account_status?: number };
export type MetaPage = {
  id: string;
  name: string;
  instagram_business_account?: { id: string; username?: string };
};

function throwMeta(error: MetaError): never {
  const message = error.error_user_msg || error.message || "Erro desconhecido da Meta";
  throw new Error(`${message} (código ${error.code ?? "?"}, subcódigo ${error.error_subcode ?? "-"})`);
}

async function graphGet(token: string, path: string, params: Record<string, string | number> = {}) {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json();
  if (data.error) throwMeta(data.error);
  return data;
}

async function graphPost(token: string, path: string, body: Record<string, unknown>) {
  const form = new URLSearchParams({ access_token: token });
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null || value === "") continue;
    form.set(key, typeof value === "object" ? JSON.stringify(value) : String(value));
  }
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const data = await response.json();
  if (data.error) throwMeta(data.error);
  return data;
}

export async function getMetaAssets(token: string): Promise<{ accounts: AdAccount[]; pages: MetaPage[] }> {
  const [accounts, pages] = await Promise.all([
    graphGet(token, "/me/adaccounts", { fields: "id,name,currency,account_status", limit: 100 }),
    graphGet(token, "/me/accounts", {
      fields: "id,name,instagram_business_account{id,username}",
      limit: 100,
    }),
  ]);
  return { accounts: accounts.data || [], pages: pages.data || [] };
}

async function uploadImage(token: string, adAccountId: string, imageUrl: string) {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) throw new Error("Não foi possível baixar a imagem do criativo.");
  const mime = imageResponse.headers.get("content-type") || "image/jpeg";
  const extension = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const form = new FormData();
  form.set("access_token", token);
  form.set("filename", new Blob([await imageResponse.arrayBuffer()], { type: mime }), `creative.${extension}`);
  const response = await fetch(`${BASE_URL}/${adAccountId}/adimages`, { method: "POST", body: form });
  const data = await response.json();
  if (data.error) throwMeta(data.error);
  const first = Object.values(data.images || {})[0] as { hash?: string } | undefined;
  if (!first?.hash) throw new Error("A Meta não retornou o identificador da imagem.");
  return first.hash;
}

export type CampaignDraft = {
  adAccountId: string;
  pageId: string;
  instagramActorId?: string;
  name: string;
  objective: "sales" | "traffic" | "leads";
  dailyBudget: number;
  link: string;
  headline: string;
  primaryText: string;
  description?: string;
  cta?: string;
  imageUrl: string;
};

export async function createPausedCampaign(token: string, input: CampaignDraft) {
  if (input.dailyBudget < 100) throw new Error("O orçamento deve estar em centavos e ser maior que R$ 1,00.");
  const objective = input.objective === "sales" ? "OUTCOME_SALES" : input.objective === "leads" ? "OUTCOME_LEADS" : "OUTCOME_TRAFFIC";

  const campaign = await graphPost(token, `/${input.adAccountId}/campaigns`, {
    name: input.name,
    objective,
    status: "PAUSED",
    special_ad_categories: [],
    buying_type: "AUCTION",
    is_adset_budget_sharing_enabled: false,
  });

  const adset = await graphPost(token, `/${input.adAccountId}/adsets`, {
    name: `${input.name} — Conjunto`,
    campaign_id: campaign.id,
    daily_budget: input.dailyBudget,
    billing_event: "IMPRESSIONS",
    optimization_goal: "LINK_CLICKS",
    bid_strategy: "LOWEST_COST_WITHOUT_CAP",
    targeting: {
      geo_locations: { countries: ["BR"] },
      publisher_platforms: ["facebook", "instagram"],
      facebook_positions: ["feed", "story", "marketplace"],
      instagram_positions: ["stream", "story", "reels", "explore"],
    },
    status: "PAUSED",
  });

  const imageHash = await uploadImage(token, input.adAccountId, input.imageUrl);
  const storySpec: Record<string, unknown> = {
    page_id: input.pageId,
    link_data: {
      image_hash: imageHash,
      link: input.link,
      message: input.primaryText,
      name: input.headline,
      description: input.description || "",
      call_to_action: { type: input.cta || "LEARN_MORE", value: { link: input.link } },
    },
  };
  if (input.instagramActorId) storySpec.instagram_actor_id = input.instagramActorId;

  const creative = await graphPost(token, `/${input.adAccountId}/adcreatives`, {
    name: `${input.name} — Criativo`,
    object_story_spec: storySpec,
  });

  const ad = await graphPost(token, `/${input.adAccountId}/ads`, {
    name: `${input.name} — Anúncio`,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  return { campaignId: campaign.id, adsetId: adset.id, creativeId: creative.id, adId: ad.id, status: "PAUSED" };
}
