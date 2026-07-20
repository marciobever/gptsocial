"use client";

import { useEffect, useState } from "react";

type Account = { id: string; name: string; currency?: string };
type Page = { id: string; name: string; instagram_business_account?: { id: string; username?: string } };
const steps = ["Campanha", "Público", "Criativos", "Revisão"];

export default function Home() {
  const [step, setStep] = useState(0);
  const [connection, setConnection] = useState<"idle" | "loading" | "connected" | "error">("idle");
  const [connectionError, setConnectionError] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [accountId, setAccountId] = useState("");
  const [pageId, setPageId] = useState("");
  const [objective, setObjective] = useState<"sales" | "leads" | "traffic">("sales");
  const [name, setName] = useState("Conversões • Produto principal • Julho");
  const [budget, setBudget] = useState("150,00");
  const [link, setLink] = useState("");
  const [headline, setHeadline] = useState("Transforme seus resultados hoje");
  const [primaryText, setPrimaryText] = useState("Uma nova forma de alcançar seus objetivos — criada para quem quer resultados de verdade.");
  const [description, setDescription] = useState("Comece agora");
  const [imageUrl, setImageUrl] = useState("");
  const [briefing, setBriefing] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [result, setResult] = useState("");
  const [existingCampaignId, setExistingCampaignId] = useState("52513336177917");
  const [firstConversionLink, setFirstConversionLink] = useState("https://www.foodsnap.com.br/lp");
  const [secondConversionLink, setSecondConversionLink] = useState("https://www.foodsnap.com.br/start");
  const [secondVariantImage, setSecondVariantImage] = useState("https://gptsocial.vercel.app/creatives/foodsnap-body-scan-02.png");
  const [secondVariantVerticalImage, setSecondVariantVerticalImage] = useState("https://gptsocial.vercel.app/creatives/foodsnap-body-scan-02-9x16.png");
  const [secondVariantLandscapeImage, setSecondVariantLandscapeImage] = useState("https://gptsocial.vercel.app/creatives/foodsnap-body-scan-02-1.91x1.png");
  const [secondVariantHeadline, setSecondVariantHeadline] = useState("Seu corpo. Seu plano.");
  const [secondVariantText, setSecondVariantText] = useState("Seu treino e sua dieta podem começar com uma foto.\n\nO FoodSnap analisa seu corpo com IA e monta um plano prático, personalizado e fácil de seguir — direto no seu celular.\n\nVeja sua análise e comece hoje.");
  const [secondVariantDescription, setSecondVariantDescription] = useState("Análise corporal, treino e dieta em um só app.");
  const [removeExploreAndMarketplace, setRemoveExploreAndMarketplace] = useState(true);
  const [updatingVariants, setUpdatingVariants] = useState(false);
  const [variantResult, setVariantResult] = useState("");

  const selectedPage = pages.find((page) => page.id === pageId);

  async function checkMeta(showErrors = false) {
    setConnection("loading");
    setConnectionError("");
    try {
      const response = await fetch("/api/meta/status");
      const data = await response.json();
      if (response.status === 401 && data.needsAuth) {
        setConnection("idle");
        if (showErrors) setConnectionError(data.error || "Faça a conexão com a Meta.");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Falha na conexão.");
      setAccounts(data.accounts || []);
      setPages(data.pages || []);
      setAccountId(data.accounts?.[0]?.id || "");
      setPageId(data.pages?.[0]?.id || "");
      setConnection("connected");
    } catch (error) {
      setConnection("error");
      setConnectionError(error instanceof Error ? error.message : "Falha na conexão.");
    }
  }

  function connectMeta() {
    if (connection === "connected") {
      void checkMeta(true);
      return;
    }
    window.location.assign("/api/meta/connect");
  }

  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("meta_error");
    if (error) {
      setConnection("error");
      setConnectionError(error);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }
    void checkMeta(false);
  }, []);

  async function publishPaused() {
    if (!accountId || !pageId) return setResult("Conecte a Meta e selecione conta e página.");
    if (!link || !imageUrl || !headline || !primaryText) return setResult("Preencha link, texto e imagem antes de publicar.");
    const dailyBudget = Math.round(Number(budget.replace(".", "").replace(",", ".")) * 100);
    if (!Number.isFinite(dailyBudget) || dailyBudget < 100) return setResult("Informe um orçamento válido.");
    if (!window.confirm(`Criar a campanha “${name}” PAUSADA na conta selecionada?`)) return;
    setPublishing(true);
    setResult("");
    try {
      const response = await fetch("/api/meta/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: accountId, pageId,
          instagramActorId: selectedPage?.instagram_business_account?.id,
          instagramUsername: selectedPage?.instagram_business_account?.username,
          name, objective, dailyBudget, link, headline, primaryText, description,
          cta: "LEARN_MORE", imageUrl,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao publicar.");
      setResult(`Campanha criada pausada. ID: ${data.campaignId}`);
      setStep(3);
    } catch (error) {
      setResult(error instanceof Error ? error.message : "Falha ao publicar.");
    } finally {
      setPublishing(false);
    }
  }

  async function updateConversionLinks() {
    if (!accountId || !existingCampaignId || !firstConversionLink || !secondConversionLink) {
      return setVariantResult("Selecione a conta e preencha a campanha e os dois links.");
    }
    setUpdatingVariants(true);
    setVariantResult("");
    try {
      const response = await fetch("/api/meta/ads/conversion-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adAccountId: accountId,
          campaignId: existingCampaignId,
          firstLink: firstConversionLink,
          secondLink: secondConversionLink,
          secondImageUrl: secondVariantImage,
          secondVerticalImageUrl: secondVariantVerticalImage,
          secondLandscapeImageUrl: secondVariantLandscapeImage,
          secondHeadline: secondVariantHeadline,
          secondPrimaryText: secondVariantText,
          secondDescription: secondVariantDescription,
          removeExploreAndMarketplace,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha ao atualizar os anúncios.");
      setVariantResult(`Dois anúncios pausados. IDs: ${data.firstAd.id} e ${data.secondAd.id}`);
    } catch (error) {
      setVariantResult(error instanceof Error ? error.message : "Falha ao atualizar os anúncios.");
    } finally {
      setUpdatingVariants(false);
    }
  }

  let previewDomain = "SEUSITE.COM";
  try { if (link) previewDomain = new URL(link.startsWith("http") ? link : `https://${link}`).hostname; } catch {}

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="brandMark">M</span><span>Meta Studio</span></div>
        <nav>
          <button className="navItem active"><span>✦</span> Nova campanha</button>
          <button className="navItem"><span>▦</span> Campanhas</button>
          <button className="navItem"><span>◫</span> Biblioteca criativa</button>
          <button className="navItem"><span>↗</span> Relatórios</button>
        </nav>
        <div className="sidebarBottom">
          <div className="safety"><span>✓</span><div><strong>Publicação segura</strong><small>Novas campanhas são criadas pausadas.</small></div></div>
          <button className="profile"><span className="avatar">MB</span><span><strong>Marcio</strong><small>Administrador</small></span><b>•••</b></button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><span className="eyebrow">CRIAR CAMPANHA</span><h1>Vamos montar algo que vende.</h1></div>
          <button className={connection === "connected" ? "connection connected" : "connection"} onClick={connectMeta} disabled={connection === "loading"}>
            <i></i>{connection === "loading" ? "Verificando..." : connection === "connected" ? "Meta conectada" : "Conectar Meta"}
          </button>
        </header>

        <div className="stepper">
          {steps.map((label, index) => (
            <button key={label} className={index === step ? "step active" : index < step ? "step done" : "step"} onClick={() => setStep(index)}>
              <span>{index < step ? "✓" : index + 1}</span>{label}
            </button>
          ))}
        </div>

        <div className="contentGrid">
          <div className="formCard">
            <div className="sectionHeading"><span className="number">01</span><div><h2>Campanha e conexão</h2><p>Núcleo do SaasMaster adaptado para publicar diretamente pela Graph API.</p></div></div>
            {connectionError && <div className="alert error">{connectionError}</div>}
            {connection === "connected" && (
              <div className="assetBox">
                <label>Conta de anúncios<select value={accountId} onChange={(e) => setAccountId(e.target.value)}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} • {a.id}</option>)}</select></label>
                <label>Página / Instagram<select value={pageId} onChange={(e) => setPageId(e.target.value)}>{pages.map((p) => <option key={p.id} value={p.id}>{p.name}{p.instagram_business_account?.username ? ` • @${p.instagram_business_account.username}` : ""}</option>)}</select></label>
              </div>
            )}

            <label>Nome da campanha<input value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label>Objetivo</label>
            <div className="objectiveGrid">
              {[["sales","Vendas","Aumentar compras e conversões","↗"],["leads","Cadastros","Capturar contatos qualificados","◎"],["traffic","Tráfego","Levar pessoas ao seu site","➜"]].map(([value, title, desc, icon]) => (
                <button key={value} className={objective === value ? "objective selected" : "objective"} onClick={() => setObjective(value as typeof objective)}>
                  <span className="objectiveIcon">{icon}</span><strong>{title}</strong><small>{desc}</small>{objective === value && <b>✓</b>}
                </button>
              ))}
            </div>

            <div className="twoCols">
              <label>Orçamento diário<div className="money"><span>R$</span><input value={budget} onChange={(e) => setBudget(e.target.value)} /></div></label>
              <label>Destino<select defaultValue="site"><option value="site">Site / Landing page</option></select></label>
            </div>
            <label>URL da oferta<input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://seusite.com/produto" /></label>

            <div className="aiBrief">
              <div className="sparkle">✦</div>
              <div><strong>Briefing para o Codex</strong><p>Preencha aqui ou me passe na conversa. Eu preparo a copy e o criativo e atualizo este projeto.</p></div>
              <textarea value={briefing} onChange={(e) => setBriefing(e.target.value)} placeholder="Produto, oferta, público, diferenciais e identidade visual..." />
              <button type="button">Geração assistida nesta conversa <span>✦</span></button>
            </div>

            <label>Título do anúncio<input value={headline} onChange={(e) => setHeadline(e.target.value)} /></label>
            <label>Texto principal<textarea className="plainTextarea" value={primaryText} onChange={(e) => setPrimaryText(e.target.value)} /></label>
            <label>Descrição<input value={description} onChange={(e) => setDescription(e.target.value)} /></label>
            <label>URL do criativo<input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="URL pública ou arquivo gerado no projeto" /></label>

            {result && <div className={result.includes("ID:") ? "alert success" : "alert error"}>{result}</div>}
            <div className="actions"><button className="draft" onClick={() => setStep(Math.min(step + 1, 3))}>Salvar rascunho</button><button className="next" onClick={publishPaused} disabled={publishing}>{publishing ? "Criando..." : "Criar pausada"}<span>→</span></button></div>

            <div className="existingCampaign">
              <div className="sectionHeading compact"><span className="number">02</span><div><h2>Links de conversão</h2><p>Atualiza o anúncio atual e cria uma segunda variação no mesmo conjunto.</p></div></div>
              <label>ID da campanha<input value={existingCampaignId} onChange={(e) => setExistingCampaignId(e.target.value)} /></label>
              <div className="twoCols">
                <label>Anúncio 01 — LP<input value={firstConversionLink} onChange={(e) => setFirstConversionLink(e.target.value)} /></label>
                <label>Anúncio 02 — Start<input value={secondConversionLink} onChange={(e) => setSecondConversionLink(e.target.value)} /></label>
              </div>
              <label>Imagem do anúncio 02<input value={secondVariantImage} onChange={(e) => setSecondVariantImage(e.target.value)} /></label>
              <div className="twoCols">
                <label>Imagem 9:16 — Stories/Reels<input value={secondVariantVerticalImage} onChange={(e) => setSecondVariantVerticalImage(e.target.value)} /></label>
                <label>Imagem 1,91:1 — Horizontal<input value={secondVariantLandscapeImage} onChange={(e) => setSecondVariantLandscapeImage(e.target.value)} /></label>
              </div>
              <label>Título do anúncio 02<input value={secondVariantHeadline} onChange={(e) => setSecondVariantHeadline(e.target.value)} /></label>
              <label>Texto principal do anúncio 02<textarea className="plainTextarea" value={secondVariantText} onChange={(e) => setSecondVariantText(e.target.value)} /></label>
              <label>Descrição do anúncio 02<input value={secondVariantDescription} onChange={(e) => setSecondVariantDescription(e.target.value)} /></label>
              <label className="placementChoice"><input type="checkbox" checked={removeExploreAndMarketplace} onChange={(e) => setRemoveExploreAndMarketplace(e.target.checked)} /> Remover Facebook Marketplace e Instagram Explorar dos dois anúncios</label>
              {variantResult && <div className={variantResult.includes("IDs:") ? "alert success" : "alert error"}>{variantResult}</div>}
              <div className="actions variantActions"><button className="next" onClick={updateConversionLinks} disabled={updatingVariants}>{updatingVariants ? "Atualizando..." : "Aplicar dois links pausados"}<span>→</span></button></div>
            </div>
          </div>

          <aside className="previewCard">
            <div className="previewTop"><span>PRÉVIA</span><div><button className="selected">Feed</button><button>Story</button></div></div>
            <div className="adMock">
              <div className="adHeader"><span className="adLogo">{selectedPage?.name?.[0] || "S"}</span><div><strong>{selectedPage?.name || "Sua marca"}</strong><small>Patrocinado · 🌐</small></div><b>•••</b></div>
              <p>{primaryText}</p>
              {imageUrl ? <img className="creativeImage" src={imageUrl} alt="Prévia do criativo" /> : <div className="creativePlaceholder"><span>✦</span><strong>Seu criativo aparecerá aqui</strong><small>Gerado pelo Codex ou enviado por você</small></div>}
              <div className="adFooter"><div><small>{previewDomain}</small><strong>{headline}</strong></div><button>Saiba mais</button></div>
              <div className="reactions">♡ Curtir　◯ Comentar　⌁ Compartilhar</div>
            </div>
            <div className="summary">
              <div><span>Objetivo</span><strong>{objective === "sales" ? "Vendas" : objective === "leads" ? "Cadastros" : "Tráfego"}</strong></div><div><span>Orçamento</span><strong>R$ {budget}/dia</strong></div><div><span>Status inicial</span><strong className="paused">● Pausada</strong></div>
            </div>
            <p className="hint">Conexão e publicação já estão ligadas ao backend local.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}
