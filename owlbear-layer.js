/* Umbra scene-object layer: Owlbear-inspired map/fog interactions. */
let sceneMaps=[],fogSelection=null,mapSelection=null,objectDrag=null,fogEraseDrag=null;

function ensureSceneLayers(){
  const world=document.querySelector('#world'); if(!world)return;
  let ml=document.querySelector('#mapItemLayer');
  if(!ml){ml=document.createElement('div');ml.id='mapItemLayer';world.insertBefore(ml,document.querySelector('#fogLayer'));}
  let menu=document.querySelector('#objectContextMenu');
  if(!menu){menu=document.createElement('div');menu.id='objectContextMenu';menu.className='objectContextMenu hidden';document.querySelector('#tabletop').append(menu);}
  const old=document.querySelector('#map'); if(old){old.removeAttribute('src');old.style.display='none';}
}

async function loadSceneMaps(){
  if(!scene)return; ensureSceneLayers();
  const {data,error}=await sb.from('scene_map_items').select('*').eq('scene_id',scene.id).order('z_index');
  if(error){console.error(error);return;} sceneMaps=data||[]; await renderSceneObjects();
}

async function renderSceneObjects(){
  ensureSceneLayers(); const layer=document.querySelector('#mapItemLayer'); layer.innerHTML='';
  for(const m of sceneMaps){if(!m.visible)continue;const a=assets.find(x=>x.id===m.asset_id),url=a?await signed(a.path):'';const el=document.createElement('div');el.className='sceneMapItem'+(mapSelection===m.id?' selected':'')+(m.locked?' locked':'');el.dataset.mapId=m.id;el.style.cssText=`left:${m.x}px;top:${m.y}px;width:${m.width}px;height:${m.height}px;transform:rotate(${m.rotation||0}deg);z-index:${m.z_index||0};background-image:url("${url}")`;el.innerHTML='<span class="objectTag">MAP</span>';el.onpointerdown=e=>sceneMapDown(e,m);el.onclick=e=>{e.stopPropagation();selectMapItem(m,e)};layer.append(el)}
  const fogLayer=document.querySelector('#fogLayer'); fogLayer.innerHTML='';
  for(const f of fogs){const el=document.createElement('div');el.className='fog fogObject'+(fogSelection===f.id?' selected':'');el.dataset.fogId=f.id;el.style.cssText=`left:${f.x}px;top:${f.y}px;width:${f.width}px;height:${f.height}px;opacity:${f.opacity}`;el.onclick=e=>{if(tool!=='select'||!can('fog'))return;e.stopPropagation();selectFog(f,e)};el.onpointerdown=e=>fogDown(e,f);fogLayer.append(el)}
}

function objectMenu(html,e){const menu=document.querySelector('#objectContextMenu');menu.innerHTML=html;menu.classList.remove('hidden');const r=document.querySelector('#tabletop').getBoundingClientRect();menu.style.left=Math.min(e.clientX-r.left,r.width-250)+'px';menu.style.top=Math.min(e.clientY-r.top,r.height-210)+'px'}
function closeObjectMenu(){document.querySelector('#objectContextMenu')?.classList.add('hidden')}
function selectFog(f,e){fogSelection=f.id;mapSelection=null;renderSceneObjects();objectMenu(`<div class="contextTitle"><b>Fog</b><small>Região individual</small></div><label>Opacidade <span id="fogOpacityValue">${Math.round(f.opacity*100)}%</span><input id="fogOpacitySlider" type="range" min="0" max="100" value="${Math.round(f.opacity*100)}"></label><div class="contextActions"><button id="fogMove">✥ Mover</button><button id="fogDelete" class="dangerButton">Excluir</button></div>`,e);document.querySelector('#fogOpacitySlider').oninput=ev=>document.querySelector('#fogOpacityValue').textContent=ev.target.value+'%';document.querySelector('#fogOpacitySlider').onchange=async ev=>{f.opacity=Number(ev.target.value)/100;await sb.rpc('update_fog_region',{p_fog_id:f.id,p_x:f.x,p_y:f.y,p_width:f.width,p_height:f.height,p_opacity:f.opacity});broadcastRefresh();renderSceneObjects()};document.querySelector('#fogMove').onclick=()=>{tool='select';closeObjectMenu()};document.querySelector('#fogDelete').onclick=async()=>{if(!confirm('Excluir esta região de fog?'))return;await sb.rpc('delete_fog_region',{p_fog_id:f.id});fogSelection=null;closeObjectMenu();await loadWorld();broadcastRefresh()}}
function fogDown(e,f){if(e.button!==0||tool!=='select'||!can('fog'))return;e.stopPropagation();const p=worldPoint(e);objectDrag={type:'fog',id:f.id,dx:p.x-f.x,dy:p.y-f.y}}

function selectMapItem(m,e){if(!can('upload_assets'))return;mapSelection=m.id;fogSelection=null;renderSceneObjects();objectMenu(`<div class="contextTitle"><b>${esc(m.name||'Mapa')}</b><small>Cenário / camada MAP</small></div><label>Rotação <span>${Math.round(m.rotation||0)}°</span><input id="mapRotation" type="range" min="0" max="359" value="${m.rotation||0}"></label><div class="contextActions"><button id="mapLock">${m.locked?'🔓 Desbloquear':'🔒 Bloquear'}</button><button id="mapDelete" class="dangerButton">Excluir da cena</button></div><small class="contextHint">Arraste para mover. Use a alça no canto para redimensionar.</small>`,e);document.querySelector('#mapRotation').onchange=async ev=>{m.rotation=Number(ev.target.value);await saveMapItem(m);broadcastRefresh();renderSceneObjects()};document.querySelector('#mapLock').onclick=async()=>{m.locked=!m.locked;await saveMapItem(m);closeObjectMenu();broadcastRefresh();renderSceneObjects()};document.querySelector('#mapDelete').onclick=async()=>{if(!confirm('Remover este mapa da cena? A imagem continuará na biblioteca.'))return;await sb.rpc('delete_scene_map_item',{p_item_id:m.id});mapSelection=null;closeObjectMenu();await loadSceneMaps();broadcastRefresh()}}
function sceneMapDown(e,m){if(e.button!==0||tool!=='select'||!can('upload_assets')||m.locked)return;e.stopPropagation();const p=worldPoint(e);objectDrag={type:'map',id:m.id,dx:p.x-m.x,dy:p.y-m.y}}
async function saveMapItem(m){return sb.rpc('update_scene_map_item',{p_item_id:m.id,p_x:m.x,p_y:m.y,p_width:m.width,p_height:m.height,p_rotation:m.rotation||0,p_locked:!!m.locked,p_visible:m.visible!==false})}

async function addMapAssetToScene(asset){if(!can('upload_assets'))return alert('Sem permissão para adicionar mapas.');const {error}=await sb.rpc('add_scene_map_item',{p_campaign_id:campaign.id,p_scene_id:scene.id,p_asset_id:asset.id});if(error)return alert(error.message);await loadSceneMaps();broadcastRefresh()}

function installSceneObjectEvents(){
  ensureSceneLayers(); const vp=document.querySelector('#viewport');
  vp.addEventListener('pointermove',e=>{if(!objectDrag)return;const p=worldPoint(e);if(objectDrag.type==='fog'){const f=fogs.find(x=>x.id===objectDrag.id);if(!f)return;f.x=p.x-objectDrag.dx;f.y=p.y-objectDrag.dy;const el=document.querySelector(`[data-fog-id="${f.id}"]`);if(el){el.style.left=f.x+'px';el.style.top=f.y+'px'}}else{const m=sceneMaps.find(x=>x.id===objectDrag.id);if(!m)return;m.x=p.x-objectDrag.dx;m.y=p.y-objectDrag.dy;const el=document.querySelector(`[data-map-id="${m.id}"]`);if(el){el.style.left=m.x+'px';el.style.top=m.y+'px'}}},true);
  vp.addEventListener('pointerup',async()=>{if(!objectDrag)return;const d=objectDrag;objectDrag=null;if(d.type==='fog'){const f=fogs.find(x=>x.id===d.id);if(f)await sb.rpc('update_fog_region',{p_fog_id:f.id,p_x:f.x,p_y:f.y,p_width:f.width,p_height:f.height,p_opacity:f.opacity})}else{const m=sceneMaps.find(x=>x.id===d.id);if(m)await saveMapItem(m)}broadcastRefresh()},true);
  vp.addEventListener('pointerdown',e=>{if(e.button!==2||tool!=='fog'||!can('fog'))return;e.preventDefault();e.stopImmediatePropagation();const start=worldPoint(e),box=document.querySelector('#selectionBox');fogEraseDrag={start};box.style.display='block';box.classList.add('eraseSelection');const move=ev=>{const q=worldPoint(ev),x=Math.min(start.x,q.x),y=Math.min(start.y,q.y),w=Math.abs(q.x-start.x),h=Math.abs(q.y-start.y);Object.assign(box.style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'})};const up=async ev=>{window.removeEventListener('pointermove',move,true);window.removeEventListener('pointerup',up,true);box.style.display='none';box.classList.remove('eraseSelection');const q=worldPoint(ev),x=Math.min(start.x,q.x),y=Math.min(start.y,q.y),w=Math.abs(q.x-start.x),h=Math.abs(q.y-start.y);fogEraseDrag=null;if(w>2&&h>2){const {error}=await sb.rpc('erase_fog_area',{p_campaign_id:campaign.id,p_scene_id:scene.id,p_x:x,p_y:y,p_width:w,p_height:h});if(error)alert(error.message);await loadWorld();broadcastRefresh()}};window.addEventListener('pointermove',move,true);window.addEventListener('pointerup',up,true)},true);
  vp.addEventListener('click',e=>{if(!e.target.closest('.fogObject,.sceneMapItem,.objectContextMenu')){fogSelection=mapSelection=null;closeObjectMenu();renderSceneObjects()}},true)
}

const baseLoadWorld=loadWorld;loadWorld=async function(){await baseLoadWorld();await loadSceneMaps()};
const baseRender=render;render=async function(){await baseRender();await renderSceneObjects()};
const baseRenderAssets=renderAssets;renderAssets=async function(){await baseRenderAssets();document.querySelectorAll('#assets .assetCard').forEach(card=>{const id=card.dataset.id||card.getAttribute('data-id');const a=assets.find(x=>x.id===id);if(a?.asset_type==='map'){card.title='Clique para adicionar este mapa como cenário';card.onclick=()=>addMapAssetToScene(a)}})};
setTimeout(installSceneObjectEvents,0);
