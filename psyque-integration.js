(()=>{
const bridge=async(payload)=>{
  const {data:{session}}=await sb.auth.getSession();
  if(!session)throw new Error('Sua sessão expirou. Entre novamente.');
  const res=await fetch(`${SUPABASE_URL}/functions/v1/psyque-bridge`,{
    method:'POST',
    headers:{'Content-Type':'application/json','apikey':SUPABASE_KEY,'Authorization':`Bearer ${session.access_token}`},
    body:JSON.stringify(payload)
  });
  const data=await res.json().catch(()=>({}));
  if(!res.ok)throw new Error(data.message||'Falha na integração com a Psyque.');
  return data;
};
const val=(v,f='—')=>v===null||v===undefined||v===''?f:String(v);
const renderSheet= s=>{
  const c=s.snapshot||{};
  const image=typeof c.image==='string'&&c.image.startsWith('data:image/')?`<img src="${c.image}" alt="" style="width:76px;height:76px;object-fit:cover;border-radius:12px;border:1px solid #343744">`:'';
  return `<article class="sheetCard" data-sheet="${s.id}" style="display:grid;grid-template-columns:${image?'76px ':''}1fr auto;gap:14px;align-items:center">
    ${image}<div><h3 style="margin:0 0 8px">${esc(s.display_name||'Ficha Psyque')}</h3>
    <p style="margin:4px 0"><b>Vida:</b> ${val(c.hp_current)} / ${val(c.hp_max)}</p>
    <p style="margin:4px 0"><b>Ruptura:</b> ${val(c.rupture_current)} / ${val(c.rupture_max)}</p>
    <small style="color:#8e929f">${s.status==='connected'?'● Conectada à Psyque':'⚠ '+esc(s.status||'desconectada')}</small></div>
    <div style="display:grid;gap:7px"><button data-sync="${s.id}" class="ghost">↻ Sincronizar</button><button data-unlink="${s.id}" class="ghost">Desvincular</button></div>
  </article>`;
};
window.loadPsyqueSheets=async()=>{
  const list=document.querySelector('#sheetList'); if(!list)return;
  list.innerHTML='<p class="muted">Carregando fichas…</p>';
  const {data,error}=await sb.from('linked_sheets').select('*').eq('provider','psyque').order('created_at',{ascending:false});
  if(error){list.innerHTML=`<p>Erro ao carregar fichas: ${esc(error.message)}</p>`;return}
  list.innerHTML=(data||[]).map(renderSheet).join('')||'<p>Nenhuma ficha vinculada.</p>';
  list.querySelectorAll('[data-sync]').forEach(b=>b.onclick=async()=>{b.disabled=true;b.textContent='Sincronizando…';try{await bridge({action:'sync',linked_sheet_id:b.dataset.sync});await loadPsyqueSheets()}catch(e){alert(e.message);b.disabled=false;b.textContent='↻ Sincronizar'}});
  list.querySelectorAll('[data-unlink]').forEach(b=>b.onclick=async()=>{if(!confirm('Desvincular esta ficha da Umbra? A ficha original na Psyque não será apagada.'))return;try{await bridge({action:'unlink',linked_sheet_id:b.dataset.unlink});await loadPsyqueSheets()}catch(e){alert(e.message)}});
};
const link=document.querySelector('#linkSheet');
if(link)link.onclick=async()=>{
  const token=prompt('Cole o token PSYQ-... gerado pelo cadeado da ficha:');
  if(!token)return;
  link.disabled=true;link.textContent='Validando…';
  try{const out=await bridge({action:'link',token});await loadPsyqueSheets();alert(`Ficha “${out.sheet?.display_name||'Psyque'}” vinculada com sucesso.`)}catch(e){alert(e.message)}finally{link.disabled=false;link.textContent='+ Vincular ficha'}
};
const sheetsNav=document.querySelector('header nav button[data-page="sheets"]');
if(sheetsNav)sheetsNav.addEventListener('click',()=>setTimeout(loadPsyqueSheets,0));
const oldNote=[...document.querySelectorAll('#sheets .muted')].find(x=>x.textContent.includes('validação do token Psyque'));
if(oldNote)oldNote.textContent='As fichas vinculadas são validadas diretamente na Psyque. Use Sincronizar para buscar os dados mais recentes.';
})();