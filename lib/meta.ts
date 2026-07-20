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
  instagramUsername?: string;
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

  // Retoma uma tentativa anterior que tenha parado depois de criar a campanha
  // ou o conjunto. Isso evita duplicações quando a Meta rejeita o criativo.
  const campaigns = await graphGet(token, `/${input.adAccountId}/campaigns`, {
    fields: "id,name,status",
    limit: 100,
  });
  let campaign = (campaigns.data || []).find((item: { name?: string }) => item.name === input.name);
  let adset: { id: string } | undefined;

  if (campaign?.id) {
    const adsets = await graphGet(token, `/${campaign.id}/adsets`, {
      fields: "id,name,status",
      limit: 100,
    });
    adset = (adsets.data || []).find((item: { name?: string }) => item.name === `${input.name} — Conjunto`);

    if (adset?.id) {
      const ads = await graphGet(token, `/${adset.id}/ads`, {
        fields: "id,name,status,creative{id}",
        limit: 100,
      });
      const existingAd = (ads.data || []).find((item: { name?: string }) => item.name === `${input.name} — Anúncio`);
      if (existingAd?.id) {
        return {
          campaignId: campaign.id,
          adsetId: adset.id,
          creativeId: existingAd.creative?.id,
          adId: existingAd.id,
          status: "PAUSED",
          resumed: true,
        };
      }
    }
  }

  // O ID elegível para anúncios deve vir da própria conta de anúncios. O ID
  // devolvido pela Página pode representar o mesmo perfil, mas não ser um
  // actor válido nessa conta. Fazemos a correspondência pelo username.
  let instagramActorId: string | undefined;
  if (input.instagramUsername) {
    try {
      const instagramAccounts = await graphGet(token, `/${input.adAccountId}/instagram_accounts`, {
        fields: "id,username",
        limit: 100,
      });
      const normalizedUsername = input.instagramUsername.replace(/^@/, "").toLowerCase();
      const matchedInstagram = (instagramAccounts.data || []).find(
        (item: { username?: string }) => item.username?.toLowerCase() === normalizedUsername,
      );
      instagramActorId = matchedInstagram?.id;
    } catch {
      // Sem actor autorizado, a campanha continua pronta para Facebook e pode
      // ganhar Instagram automaticamente após a vinculação na BM.
    }
  }

  const targeting = {
    geo_locations: { countries: ["BR"] },
    publisher_platforms: instagramActorId ? ["facebook", "instagram"] : ["facebook"],
    facebook_positions: ["feed", "story", "marketplace"],
    ...(instagramActorId ? { instagram_positions: ["stream", "story", "reels", "explore"] } : {}),
  };

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
  if (instagramActorId) storySpec.instagram_actor_id = instagramActorId;

  const creative = await graphPost(token, `/${input.adAccountId}/adcreatives`, {
    name: `${input.name} — Criativo`,
    object_story_spec: storySpec,
  });

  if (!campaign?.id) {
    campaign = await graphPost(token, `/${input.adAccountId}/campaigns`, {
      name: input.name,
      objective,
      status: "PAUSED",
      special_ad_categories: [],
      buying_type: "AUCTION",
      is_adset_budget_sharing_enabled: false,
    });
  }

  if (!adset?.id) {
    adset = await graphPost(token, `/${input.adAccountId}/adsets`, {
      name: `${input.name} — Conjunto`,
      campaign_id: campaign.id,
      daily_budget: input.dailyBudget,
      billing_event: "IMPRESSIONS",
      optimization_goal: "LINK_CLICKS",
      bid_strategy: "LOWEST_COST_WITHOUT_CAP",
      targeting,
      status: "PAUSED",
    });
  } else {
    await graphPost(token, `/${adset.id}`, { targeting, status: "PAUSED" });
  }

  if (!campaign?.id || !adset?.id) {
    throw new Error("A Meta não retornou os identificadores da campanha e do conjunto.");
  }

  const ad = await graphPost(token, `/${input.adAccountId}/ads`, {
    name: `${input.name} — Anúncio`,
    adset_id: adset.id,
    creative: { creative_id: creative.id },
    status: "PAUSED",
  });

  return {
    campaignId: campaign.id,
    adsetId: adset.id,
    creativeId: creative.id,
    adId: ad.id,
    status: "PAUSED",
    instagramEnabled: Boolean(instagramActorId),
  };
}
