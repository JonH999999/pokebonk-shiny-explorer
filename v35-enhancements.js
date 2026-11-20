/* PokéBonk 异色地图图鉴 v35：常规路线与非常规目标说明（Jon） */
(function () {
  'use strict';
  if (window.__pbExplorerV35) return;
  window.__pbExplorerV35 = true;
  const oldRender = render;
  const oldLegendDetail = specialLegendaryDetail;
  const specialFamilies = DB.roster.filter(p => !hasSource(p, 'regular') && hasSource(p, 'special'));
  const unavailableFamilies = DB.roster.filter(p => !hasSource(p, 'regular') && !hasSource(p, 'special') && !SPECIAL_LEGENDARY_IDS.includes(p.id));

  function hasSource(p, kind, map, floor) {
    const maps = map && map !== 'all' ? [map] : MAPS;
    const stages = floor && floor !== 'all' ? [Number(floor)] : [1, 2, 3];
    return maps.some(m => stages.some(s => (DB.current[m] && DB.current[m][String(s)] && DB.current[m][String(s)][kind] || []).some(id => SP[id] && SP[id].family === p.family)));
  }
  function matchesSearch(p) {
    const q = state.q.toLowerCase().replace('#', '').trim();
    return !q || String(p.id).includes(q) || p.name.toLowerCase().includes(q) || Object.values(SP).some(s => s.family === p.family && s.name.toLowerCase().includes(q));
  }
  function showEntry(p) {
    return matchesSearch(p) && (!state.hideOwned || !owned[state.variant].has(p.id));
  }
  function specialMaps(p) {
    return MAPS.filter(m => hasSource(p, 'special', m));
  }
  function explain(p, category) {
    const isClassic = state.variant === 'classic';
    if (category === 'special') return isClassic
      ? '本家族仅有地图级特殊来源；当前已核对的 classicPool 常规候选没有本家族，地图特殊出没本身不增加经典资格。其他独立获取方式未核实。'
      : '不在常规敌人候选池；符合当前游戏规则时可通过地图特殊来源参与普通自然异色候选。';
    return '当前图鉴覆盖的10张地图的常规及特殊来源均未记录此家族，无法据此推荐自然刷闪路线；不代表其他获取方式或后续版本绝对不存在。';
  }
  function detailExceptional(p, category) {
    $('detailTitle').textContent = p.name + ' · #' + p.id;
    const why = explain(p, category);
    const mapList = specialMaps(p).map(mapName).join('、');
    const members = Object.values(SP).filter(s => s.family === p.family).map(s => s.name + ' #' + s.id).join('、');
    const html = '<div class="exceptionalDetail"><div class="playerHint">' + escap(why) + '</div>'
      + '<p><b>家族成员：</b>' + escap(members) + '</p>'
      + (category === 'special' ? '<p><b>已核对的地图级特殊出没来源：</b>' + escap(mapList || '无') + '</p><p class="muted">这里不对 specials 的每一层实际敌人刷新作出保证；普通自然异色计划、地图特殊敌人行为与经典自然池是不同的条件。</p>' : '<p class="muted">当前无已确认的普通／经典自然路线。以上仅依据本图鉴收录的游戏构建与地图数据。</p>')
      + '</div>';
    $('detail').innerHTML = html;
    $('modalBG').classList.add('open');
  }
  function exceptionalCard(p, category) {
    const special = category === 'special';
    const tag = special ? state.variant === 'classic' ? '经典自然池无路线' : '普通异色特殊来源' : '未发现自然异色来源';
    const el = document.createElement('button');
    el.type = 'button'; el.className = 'mon exceptionalCard';
    el.innerHTML = avatarMarkup(p.id)
      + '<div class="name">' + escap(p.name) + '<small>#' + p.id + '</small></div>'
      + '<div class="tags"><span class="tag exceptionalTag">' + escap(tag) + '</span>'
      + (owned[state.variant].has(p.id) ? '<span class="tag old">✓ 已收集</span>' : '') + '</div>'
      + '<div class="loc">' + escap(explain(p, category)) + '<span class="exceptionalLocations">' + escap(special ? specialMaps(p).map(mapName).join(' · ') : '当前10张地图均无常规或特殊自然来源记录') + '</span></div>';
    el.onclick = () => {
      if (state.mark) {
        const set = owned[state.variant];
        if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
        localStorage.setItem('pb-exclude-owned-' + state.variant, JSON.stringify([...set]));
        render();
      } else detailExceptional(p, category);
    };
    return el;
  }
  function addSection(title, note, list, kind) {
    if (!list.length) return;
    const section = document.createElement('section');
    section.className = 'exceptionalSection';
    const heading = document.createElement('div');
    heading.className = 'section';
    heading.innerHTML = '<div><h3>' + escap(title) + ' <span class="secCount">' + list.length + ' 项</span></h3><p>' + escap(note) + '</p></div>';
    const grid = document.createElement('div');
    grid.className = 'cards';
    list.forEach(p => grid.append(exceptionalCard(p, kind)));
    section.append(heading, grid);
    $('results').append(section);
  }
  function removeDuplicateSpecialCards() {
    if (state.variant !== 'normal') return;
    const IDs = new Set(specialFamilies.map(p => p.id));
    for (const section of $('results').querySelectorAll(':scope > section')) {
      let count = 0;
      for (const card of section.querySelectorAll('.cards > .mon')) {
        const name = card.querySelector('.name small');
        const id = name ? Number(name.textContent.replace('#', '')) : 0;
        if (IDs.has(id)) card.remove(); else count++;
      }
      const countNode = section.querySelector('.secCount');
      if (countNode) countNode.textContent = count + ' 项';
      if (!count && section.querySelector('.cards') && !section.querySelector('.cards > .empty')) {
        const empty = document.createElement('p');
        empty.className = 'empty'; empty.textContent = '当前没有常规自然来源目标，以下查看特殊或未确认路线的目标。';
        section.querySelector('.cards').append(empty);
      }
    }
  }
  function v35Legendary() {
    const all = state.variant === 'classic' ? SPECIAL_LEGENDARY_IDS : legendaryIdsForScope();
    const classic = state.variant === 'classic';
    $('specialMetric').style.display = 'flex';
    $('legendarySection').style.display = 'block';
    $('countTotal').textContent = all.length;
    $('labelTotal').textContent = '特殊神兽';
    $('specialMetricHint').textContent = '点击展开';
    const head = $('legendarySection').querySelector('.legendaryFoldLead strong');
    const sub = $('legendarySection').querySelector('.legendaryFoldLead > span');
    if (head) head.textContent = classic ? '🌟 特殊神兽 · 经典自然池无路线（' + all.length + ' 项）' : '🌟 特殊神兽异色 · ' + all.length + ' 项';
    if (sub) sub.textContent = classic ? '普通异色可有独立特殊遭遇；不等于经典自然异色可刷' : '额外特殊遭遇与第4层圣域分开判断';
    $('legendaryQuickStats').innerHTML = classic ? '<span><b>' + all.length + '</b> 个神兽没有经典自然路线</span><span>已知普通异色特殊遭遇不证明经典资格</span>'
      : '<span><b>' + all.length + '</b> 个符合楼层范围的特殊事件目标</span><span>初始异色判定 <b>3%</b></span><span>仍须满足解锁、追踪及本局条件</span>';
    $('legendaryMapHeading').textContent = classic ? '✨ 普通异色特殊遭遇说明（经典自然池无路线）' : '✨ 特殊遭遇（不是第4层圣域）';
    $('legendaryMapSub').textContent = classic ? '当前经典自然池没有这五只神兽的确认候选；下面的独立遭遇和圣域仅作为普通异色机制说明。'
      : '额外传奇捕获遭遇不按固定地图的普通池筛选；超梦首领事件仅第2、3层。实际出现仍受账号与本局条件限制。';
    const dist = $('legendaryDistribution'), grid = $('legendaryCards');
    dist.replaceChildren();grid.replaceChildren();
    for (const id of all) {
      const p = ID[id]; if (!p) continue;
      const guide = LEGENDARY_GUIDE[id];
      const box = document.createElement('div');
      box.innerHTML = '<span class="legendaryMapEmoji">' + (id === 144 ? '❄️' : id === 145 ? '⚡' : id === 146 ? '🔥' : id === 150 ? '🧬' : '🌿') + '</span><strong>' + escap(p.name) + '</strong><span>' + (classic ? '经典自然池无路线' : guide.kind === 'boss' ? '第2、3层特殊首领事件' : '独立特殊遭遇') + '</span><small>普通异色圣域：' + escap(guide.map) + '</small>';
      dist.append(box);
      if (!showEntry(p)) continue;
      const card = document.createElement('button');
      card.type = 'button';card.className = 'mon';
      card.innerHTML = avatarMarkup(p.id) + '<div class="name">' + escap(p.name) + '<small>#' + p.id + '</small></div>'
        + '<div class="tags"><span class="tag legendary">' + (classic ? '经典自然池无路线' : '普通异色独立特殊遭遇') + '</span>'
        + (owned[state.variant].has(p.id) ? '<span class="tag old">✓ 已收集</span>' : '') + '</div>'
        + '<div class="loc">' + (classic ? '普通异色存在独立特殊遭遇；经典自然资格未确认' : '符合条件的特殊遭遇；另有第4层圣域') + '<br>' + escap(guide.map) + '</div>';
      card.onclick = () => {
        if (state.mark) {
          const set = owned[state.variant];
          if (set.has(p.id)) set.delete(p.id); else set.add(p.id);
          localStorage.setItem('pb-exclude-owned-' + state.variant, JSON.stringify([...set]));
          render();
        } else specialLegendaryDetail(p);
      };
      grid.append(card);
    }
    if (!grid.children.length) {
      const empty = document.createElement('div'); empty.className = 'empty';
      empty.textContent = '没有符合当前搜索或收藏筛选的神兽。';grid.append(empty);
    }
    $('specialMetric').classList.toggle('active', $('legendaryFold').open);
  }

  renderSpecialLegendary = v35Legendary;
  specialLegendaryDetail = function (p) {
    if (state.variant !== 'classic') return oldLegendDetail(p);
    const g = LEGENDARY_GUIDE[p.id];
    $('detailTitle').textContent = p.name + ' · #' + p.id;
    $('detail').innerHTML = '<div class="legendaryDetail"><div class="playerHint">该神兽当前没有已确认的经典自然刷新路线；不能把普通异色特殊遭遇直接算作经典异色来源。</div>'
      + '<p>已知的普通异色特殊遭遇：' + escap(g.route) + '</p>'
      + '<p>第4层圣域：' + escap(g.map) + ' · ' + escap(g.place) + '。其他经典获取方式尚未全部核实。</p></div>';
    $('modalBG').classList.add('open');
  };
  const styles = document.createElement('style');
  styles.textContent = '.exceptionalSection{margin:25px 0 8px}.exceptionalSection .section h3{font-size:17px}.exceptionalCard{min-height:215px}.exceptionalCard .loc{line-height:1.65;overflow-wrap:anywhere}.exceptionalCard .exceptionalTag{color:var(--gold);border-color:color-mix(in srgb,var(--gold) 45%,var(--border))}.exceptionalLocations{display:block;color:var(--muted);margin-top:8px}#classicGap{display:none!important}.exceptionalDetail p{line-height:1.75}';
  document.head.append(styles);
  try {
    if (localStorage.getItem('pb-theme') === 'light') {
      document.body.classList.add('light');
      $('theme').textContent = '☾ 深色模式';
    }
  } catch {}
  $('theme').onclick = () => {
    document.body.classList.toggle('light');
    const value = document.body.classList.contains('light') ? 'light' : 'dark';
    $('theme').textContent = value === 'light' ? '☾ 深色模式' : '☀ 亮色模式';
    try {localStorage.setItem('pb-theme', value)} catch {}
  };
  state.map = 'all';
  state.stage = 'all';
  state.variant = 'normal';
  state.others = false;
  state.hideOwned = false;
  state.q = '';
  $('search').value = '';
  $('others').checked = false;
  $('hideOwned').checked = false;

  render = function () {
    oldRender();
    if (document.body.classList.contains('spawnView')) return;
    removeDuplicateSpecialCards();
    $('labelDirect').textContent = state.variant === 'normal' ? '普通异色候选（含特殊）' : '经典自然候选';
    const ordinary = $('results').querySelector(':scope > section .section h3');
    if (ordinary && ordinary.textContent.startsWith('本次筛选的异色')) ordinary.firstChild.textContent = '常规自然池候选 ';
    const special = specialFamilies.filter(p => showEntry(p) && (state.map === 'all' || hasSource(p, 'special', state.map)));
    const missing = unavailableFamilies.filter(showEntry);
    addSection(state.variant === 'classic' ? '特殊家族 · 当前经典自然池无路线' : '特殊家族 · 普通异色特殊来源',
      state.variant === 'classic' ? '地图特殊物种的存在，不代表 classicPool 有对应自然经典候选。' : '这些家族不在常规敌人候选中，普通异色可由符合条件的地图特殊池产生；地图级来源不证明具体楼层。',
      special, 'special');
    addSection('当前图鉴未发现自然路线的目标',
      '当前10张地图常规及特殊来源均未收录；这组为全局解释，不随具体地图／楼层筛选隐藏，其他获取方式待核实。',
      missing, 'none');
  };
  render();
})();
