/**
 * 18+ 情侣真心话大冒险 - 核心游戏引擎 (game.js)
 */

// ==========================================================================
// 1. 全局状态与配置
// ==========================================================================
const state = {
  screen: 'setup', // 'setup' | 'play'
  players: [
    { name: '', gender: 'male', pronoun: '他' },
    { name: '', gender: 'female', pronoun: '她' }
  ],
  activePlayerIdx: 0, // 当前选择的玩家索引
  heatLevel: 2, // 当前热度级别 1, 2, 3, 4
  customPool: [], // 本地自定义题库
  currentCard: null, // 当前抽中的卡片 { type: 'truth'|'dare'|'penalty', text: '', isFlipped: false }
  history: {
    truth: [],
    dare: [],
    penalty: []
  },
  soundEnabled: true
};

// 热度描述常量
const HEAT_LEVELS_INFO = {
  1: {
    title: "微醺温存 (Warm Up)",
    desc: "甜蜜纯爱互动，温和的真心话，轻微的身体接触。非常适合刚刚开始游戏、舒缓紧张情绪时的热身阶段。"
  },
  2: {
    title: "暧昧调情 (Flirting)",
    desc: "带有暗示性的话题、挑逗性肢体接触与亲吻。温度逐渐上升，打破害羞，眼神与肢体开始产生电火花。"
  },
  3: {
    title: "烈火激情 (Passion)",
    desc: "深入敏感带的爱抚、衣物部分脱除、半蒙眼/轻度束缚挑战。充满强烈荷尔蒙的互动，让心跳彻底爆表！"
  },
  4: {
    title: "狂热禁忌 (R18+ Explicit)",
    desc: "极度私密、高尺度探索与性幻想。包含性爱姿势模仿、私密口交服务等，属于情侣间的专属狂欢！"
  }
};

// ==========================================================================
// 2. DOM 元素缓存
// ==========================================================================
let elements = {};

function initDOMElements() {
  elements = {
    setupScreen: document.getElementById('setup-screen'),
    gameScreen: document.getElementById('game-screen'),
    
    // Setup inputs
    p1Name: document.getElementById('p1-name'),
    p2Name: document.getElementById('p2-name'),
    p1Genders: document.querySelectorAll('.player-block-1 .gender-btn'),
    p2Genders: document.querySelectorAll('.player-block-2 .gender-btn'),
    heatSlider: document.getElementById('heat-slider'),
    heatBadge: document.getElementById('heat-badge'),
    heatTitle: document.getElementById('heat-title'),
    heatDesc: document.getElementById('heat-desc'),
    btnStart: document.getElementById('btn-start'),
    
    // Game screen elements
    turnAvatar: document.getElementById('turn-avatar'),
    turnName: document.getElementById('turn-name'),
    quickHeatBadge: document.getElementById('quick-heat-badge'),
    quickHeatText: document.getElementById('quick-heat-text'),
    
    // 3D Card
    cardContainer: document.getElementById('card-container'),
    cardInner: document.getElementById('card-inner'),
    cardBack: document.getElementById('card-back'),
    cardPrompt: document.getElementById('card-prompt'),
    cardBadge: document.getElementById('card-badge'),
    cardStars: document.getElementById('card-stars'),
    
    // Action buttons
    decisionBtns: document.getElementById('decision-buttons'),
    completeBtns: document.getElementById('complete-buttons'),
    btnTruth: document.getElementById('btn-truth'),
    btnDare: document.getElementById('btn-dare'),
    btnDone: document.getElementById('btn-done'),
    btnForfeit: document.getElementById('btn-forfeit'),
    btnSkipPenalty: document.getElementById('btn-skip-penalty'),
    
    // Drawer panel
    drawerOverlay: document.getElementById('drawer-overlay'),
    drawer: document.getElementById('drawer'),
    btnOpenDrawer: document.getElementById('btn-open-drawer'),
    btnCloseDrawer: document.getElementById('btn-close-drawer'),
    btnSoundToggle: document.getElementById('btn-sound-toggle'),
    
    // Custom list inputs
    customType: document.getElementsByName('custom-type'),
    customText: document.getElementById('custom-text'),
    btnAddCustom: document.getElementById('btn-add-custom'),
    customItemsList: document.getElementById('custom-items-list')
  };
}

// ==========================================================================
// 3. Web Audio API 声音合成引擎
// ==========================================================================
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}

function playSound(type, param) {
  if (!state.soundEnabled) return;
  try {
    initAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    
    const now = audioCtx.currentTime;
    
    if (type === 'click') {
      // 甜美微小的点击声
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } 
    else if (type === 'level_change') {
      // 热度级别滑动时：根据热度水平改变音高的清脆叮咚声 (LV.1低沉，LV.4尖锐明亮)
      const level = param || 2;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      // 频率动态范围：400Hz (Level 1) ~ 850Hz (Level 4)
      const targetFreq = 250 + level * 150;
      osc.frequency.setValueAtTime(targetFreq, now);
      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    }
    else if (type === 'start_game') {
      // 步入游戏：梦幻宏大的温和合成器和弦拉升 (多重正弦波共鸣)
      const freqs = [196.00, 261.63, 329.63, 392.00, 523.25]; // G3, C4, E4, G4, C5
      freqs.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);
        // 音高平滑微升，增加飘逸感
        osc.frequency.linearRampToValueAtTime(freq * 1.05, now + idx * 0.08 + 0.6);
        gain.gain.setValueAtTime(0.04, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.6);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.6);
      });
    }
    else if (type === 'truth') {
      // 抽取真心话：闪烁的空灵水晶风铃音 (高音晶莹琶音)
      const notes = [659.25, 783.99, 987.77, 1318.51]; // E5, G5, B5, E6
      notes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.06);
        gain.gain.setValueAtTime(0.03, now + idx * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.5);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + idx * 0.06);
        osc.stop(now + idx * 0.06 + 0.5);
      });
    }
    else if (type === 'dare') {
      // 抽取大冒险：激进的火焰流光上升滑音 (带有颤音震荡)
      const osc = audioCtx.createOscillator();
      const vibrato = audioCtx.createOscillator();
      const vibratoGain = audioCtx.createGain();
      const gain = audioCtx.createGain();
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(720, now + 0.55); // 激情拉升！
      
      vibrato.frequency.setValueAtTime(25, now); // 25Hz 快速抖动模拟火星裂开
      vibratoGain.gain.setValueAtTime(45, now); // 抖动深度
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      
      gain.gain.setValueAtTime(0.05, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      vibrato.start(now);
      osc.start(now);
      vibrato.stop(now + 0.55);
      osc.stop(now + 0.55);
    }
    else if (type === 'deal') {
      // 备用卡片发牌声
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.3);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    }
    else if (type === 'flip') {
      // 3D 翻牌：空气快速扫风物理声 (低通滤波锯齿波)
      const osc = audioCtx.createOscillator();
      const filter = audioCtx.createBiquadFilter();
      const gain = audioCtx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.25);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(250, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.25);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 0.25);
    } 
    else if (type === 'success') {
      // 任务完成：华丽、明快的大调和弦 (清脆剔透的琶音)
      const freqs = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      freqs.forEach((freq, index) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + index * 0.07);
        gain.gain.setValueAtTime(0.04, now + index * 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, now + index * 0.07 + 0.4);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + index * 0.07);
        osc.stop(now + index * 0.07 + 0.4);
      });
    } 
    else if (type === 'penalty') {
      // 认罚喝酒：可爱的液体咕噜咕噜倒水声 (Glug-Glug-Glug 实时气泡泡合成)
      // 连续产生5个极短的向上频率扫除，随着下咽动作音高逐渐走低，极其逼真好玩！
      for (let i = 0; i < 5; i++) {
        const bubbleTime = now + i * 0.11;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        
        // 每个咕噜水泡的起始音高随吞咽深度而降低
        const baseFreq = 230 - i * 18;
        osc.frequency.setValueAtTime(baseFreq, bubbleTime);
        // 水泡向上冒起爆破：频率迅速升至2.2倍
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, bubbleTime + 0.07);
        
        gain.gain.setValueAtTime(0.05, bubbleTime);
        gain.gain.exponentialRampToValueAtTime(0.001, bubbleTime + 0.07);
        
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(bubbleTime);
        osc.stop(bubbleTime + 0.07);
      }
    }
  } catch (e) {
    console.warn("Web Audio API failed or blocked: ", e);
  }
}

// ==========================================================================
// 4. Canvas 微光粒子背景引擎与交互特效
// ==========================================================================
function initCanvasParticles() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let particles = [];
  let sparks = [];
  
  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  
  window.addEventListener('resize', resize);
  resize();
  
  // 基础浮空背景粒子
  class Particle {
    constructor() {
      this.reset();
    }
    
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height + canvas.height;
      this.size = Math.random() * 4 + 1;
      this.speedY = -(Math.random() * 0.8 + 0.2);
      this.speedX = (Math.random() * 0.4 - 0.2);
      this.opacity = Math.random() * 0.5 + 0.1;
      const randomHue = Math.random() > 0.5 ? 330 : 195;
      this.color = `hsla(${randomHue}, 100%, 75%, `;
    }
    
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      if (this.y < 0) {
        this.reset();
      }
    }
    
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.opacity + ')';
      ctx.shadowBlur = this.size * 2;
      ctx.shadowColor = this.color.includes('330') ? 'hsla(330, 100%, 65%, 0.5)' : 'hsla(195, 100%, 55%, 0.5)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  
  // 鼠标/触控交互溅射粒子
  class Spark {
    constructor(x, y, hue) {
      this.x = x;
      this.y = y;
      this.size = Math.random() * 5 + 2;
      this.speedY = (Math.random() * 2 - 1) - 0.5; // 轻微向上浮动
      this.speedX = (Math.random() * 2 - 1);
      this.opacity = 1;
      this.color = `hsla(${hue}, 100%, 75%, `;
      this.decay = Math.random() * 0.02 + 0.015; // 渐隐率
    }
    
    update() {
      this.y += this.speedY;
      this.x += this.speedX;
      this.opacity -= this.decay;
      if (this.size > 0.2) this.size -= 0.06;
    }
    
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = this.color + this.opacity + ')';
      ctx.shadowBlur = this.size * 3;
      ctx.shadowColor = this.color.includes('330') ? 'hsla(330, 100%, 65%, 0.6)' : 'hsla(195, 100%, 55%, 0.6)';
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
  
  // 生成60个基础背景粒子
  for (let i = 0; i < 60; i++) {
    particles.push(new Particle());
    particles[i].y = Math.random() * canvas.height;
  }
  
  // 鼠标移动监听 - 释放微光
  window.addEventListener('mousemove', (e) => {
    if (Math.random() > 0.6) { // 限制密度以获得极佳性能
      const hue = Math.random() > 0.5 ? 330 : 195;
      sparks.push(new Spark(e.clientX, e.clientY, hue));
    }
  });
  
  // 触屏滑动监听 - 释放微光
  window.addEventListener('touchmove', (e) => {
    if (e.touches.length > 0 && Math.random() > 0.5) {
      const hue = Math.random() > 0.5 ? 330 : 195;
      sparks.push(new Spark(e.touches[0].clientX, e.touches[0].clientY, hue));
    }
  }, { passive: true });
  
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 暗红紫渐变底色
    const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 10, canvas.width/2, canvas.height/2, canvas.width);
    grad.addColorStop(0, 'rgba(25, 15, 45, 0.7)');
    grad.addColorStop(1, 'rgba(10, 5, 20, 1)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // 渲染普通微光浮动粒子
    particles.forEach(p => {
      p.update();
      p.draw();
    });
    
    // 渲染并更新交互溅射粒子
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.update();
      if (s.opacity <= 0) {
        sparks.splice(i, 1);
      } else {
        s.draw();
      }
    }
    
    requestAnimationFrame(animate);
  }
  
  animate();
}

// ==========================================================================
// 5. 核心业务逻辑与代词匹配引擎
// ==========================================================================

/**
 * 将模板字符串解析并替换为当前情侣数据
 */
function parsePrompt(text) {
  const self = state.players[state.activePlayerIdx];
  const partner = state.players[1 - state.activePlayerIdx];
  
  return text
    .replace(/{self}/g, `<span style="color: hsl(var(--primary-purple)); font-weight: 800;">${self.name}</span>`)
    .replace(/{partner}/g, `<span style="color: hsl(var(--primary-pink)); font-weight: 800;">${partner.name}</span>`)
    .replace(/{self_pron}/g, self.pronoun)
    .replace(/{partner_pron}/g, partner.pronoun);
}

/**
 * 性别转中文人称
 */
function getPronounByGender(gender) {
  if (gender === 'male') return '他';
  if (gender === 'female') return '她';
  return 'TA';
}

/**
 * 从本地缓存加载自定义题库与设置
 */
function loadFromLocalStorage() {
  try {
    // 加载玩家信息
    const savedP1Name = localStorage.getItem('qd_p1_name');
    const savedP1Gender = localStorage.getItem('qd_p1_gender');
    const savedP2Name = localStorage.getItem('qd_p2_name');
    const savedP2Gender = localStorage.getItem('qd_p2_gender');
    const savedHeat = localStorage.getItem('qd_heat_level');
    
    if (savedP1Name) elements.p1Name.value = savedP1Name;
    if (savedP2Name) elements.p2Name.value = savedP2Name;
    
    if (savedP1Gender) {
      state.players[0].gender = savedP1Gender;
      state.players[0].pronoun = getPronounByGender(savedP1Gender);
      elements.p1Genders.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === savedP1Gender);
      });
    }
    
    if (savedP2Gender) {
      state.players[1].gender = savedP2Gender;
      state.players[1].pronoun = getPronounByGender(savedP2Gender);
      elements.p2Genders.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.gender === savedP2Gender);
      });
    }
    
    if (savedHeat) {
      state.heatLevel = parseInt(savedHeat);
      elements.heatSlider.value = savedHeat;
      updateHeatUI(savedHeat);
    }
    
    // 加载自定义题目
    const savedCustoms = localStorage.getItem('qd_custom_pool');
    if (savedCustoms) {
      state.customPool = JSON.parse(savedCustoms);
      renderCustomItems();
    }
  } catch (e) {
    console.error("Local storage error: ", e);
  }
}

/**
 * 渲染自定义面板列表
 */
function renderCustomItems() {
  const container = elements.customItemsList;
  if (state.customPool.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="clipboard-list"></i>
        <span>当前无自定义题目</span>
      </div>
    `;
    lucide.createIcons();
    return;
  }
  
  container.innerHTML = '';
  state.customPool.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'custom-item';
    
    const typeLabel = item.type === 'truth' ? '真心话' : '大冒险';
    const typeClass = item.type === 'truth' ? 'type-tag-truth' : 'type-tag-dare';
    
    div.innerHTML = `
      <span class="custom-item-type ${typeClass}">${typeLabel}</span>
      <span class="custom-item-text">${item.text}</span>
      <button class="delete-btn" data-index="${idx}">
        <i data-lucide="trash-2"></i>
      </button>
    `;
    container.appendChild(div);
  });
  
  // 绑定删除事件
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      const idx = parseInt(this.dataset.index);
      playSound('click');
      state.customPool.splice(idx, 1);
      localStorage.setItem('qd_custom_pool', JSON.stringify(state.customPool));
      renderCustomItems();
    });
  });
  
  lucide.createIcons();
}

/**
 * 滑动热度条 UI 联动
 */
function updateHeatUI(level) {
  const info = HEAT_LEVELS_INFO[level];
  elements.heatBadge.textContent = `LEVEL ${level}`;
  elements.heatTitle.textContent = info.title;
  elements.heatDesc.textContent = info.desc;
  
  // 改变徽章边框阴影色以彰显热度
  let color = 'hsl(var(--primary-cyan))';
  if (level == 2) color = 'hsl(var(--accent-gold))';
  if (level == 3) color = 'hsl(var(--primary-pink))';
  if (level == 4) color = 'hsl(var(--accent-red))';
  
  elements.heatBadge.style.borderColor = color;
  elements.heatBadge.style.color = color;
  elements.heatBadge.style.boxShadow = `0 0 10px ${color}`;
}

/**
 * 切换玩家回合
 */
function switchTurn() {
  state.activePlayerIdx = 1 - state.activePlayerIdx;
  const currPlayer = state.players[state.activePlayerIdx];
  
  // 更新主界面玩家文字
  elements.turnName.textContent = currPlayer.name;
  
  // 头像自适应变色与样式
  if (state.activePlayerIdx === 0) {
    elements.turnAvatar.classList.remove('partner-turn');
    elements.turnAvatar.innerHTML = `<i data-lucide="heart"></i>`;
  } else {
    elements.turnAvatar.classList.add('partner-turn');
    elements.turnAvatar.innerHTML = `<i data-lucide="sparkles"></i>`;
  }
  
  lucide.createIcons();
}

/**
 * 抽卡前重置卡片状态
 */
function resetCardState() {
  elements.cardInner.classList.remove('is-flipped');
  state.currentCard = null;
  
  // 显示双选按钮，隐藏结案/认罚按钮
  elements.decisionBtns.classList.remove('hidden');
  elements.completeBtns.classList.add('hidden');
  
  // 正面指示恢复
  const frontIcon = elements.cardContainer.querySelector('.card-pulse-icon');
  frontIcon.innerHTML = `<i data-lucide="help-circle"></i>`;
  frontIcon.style.borderColor = 'rgba(255, 255, 255, 0.05)';
  frontIcon.style.color = 'hsl(var(--text-secondary))';
  frontIcon.style.boxShadow = 'none';
  
  lucide.createIcons();
}

/**
 * 核心抽卡方法
 * @param {string} type 'truth' | 'dare'
 */
function drawCard(type) {
  playSound(type);
  
  // 1. 获取对应的题库列表
  let sourceList = [];
  if (type === 'truth') {
    sourceList = [...TRUTH_DATABASE[`level${state.heatLevel}`]];
  } else {
    sourceList = [...DARE_DATABASE[`level${state.heatLevel}`]];
  }
  
  // 2. 混合本地自定义题目（如果类型相同）
  const matchingCustom = state.customPool.filter(item => item.type === type);
  matchingCustom.forEach(c => sourceList.push(c.text));
  
  // 3. 去重与历史过滤
  let availableList = sourceList.filter(item => !state.history[type].includes(item));
  if (availableList.length === 0) {
    // 题库如果抽干，清空历史，重新抽取
    state.history[type] = [];
    availableList = sourceList;
  }
  
  // 4. 随机抓取
  const randomIndex = Math.floor(Math.random() * availableList.length);
  const selectedText = availableList[randomIndex];
  
  // 记录历史
  state.history[type].push(selectedText);
  
  // 5. 设置当前卡片状态
  state.currentCard = {
    type: type,
    text: selectedText,
    isFlipped: false
  };
  
  // 6. 渲染卡片背面
  renderCardBack(type, selectedText);
  
  // 7. 特效：卡片正面发光
  const frontIcon = elements.cardContainer.querySelector('.card-pulse-icon');
  const targetColor = type === 'truth' ? 'hsl(var(--primary-cyan))' : 'hsl(var(--primary-pink))';
  frontIcon.innerHTML = type === 'truth' ? `<i data-lucide="help-circle"></i>` : `<i data-lucide="flame"></i>`;
  frontIcon.style.borderColor = targetColor;
  frontIcon.style.color = targetColor;
  frontIcon.style.boxShadow = `0 0 25px ${targetColor}`;
  lucide.createIcons();
  
  // 8. 触发流光翻牌边框加载，0.6秒后自动翻牌
  elements.cardContainer.classList.add('sparkle-border');
  
  setTimeout(() => {
    elements.cardContainer.classList.remove('sparkle-border');
    flipCard();
  }, 600);
}

/**
 * 翻牌动作
 */
function flipCard() {
  if (!state.currentCard) return;
  playSound('flip');
  elements.cardInner.classList.add('is-flipped');
  state.currentCard.isFlipped = true;
  
  // 抽卡决断按钮淡出，展示“完成”和“认罚”
  elements.decisionBtns.classList.add('hidden');
  elements.completeBtns.classList.remove('hidden');
  elements.btnSkipPenalty.classList.add('hidden'); // 默认隐藏跳过惩罚
}

/**
 * 渲染卡片背面数据
 */
function renderCardBack(type, text) {
  elements.cardBack.className = `card-face card-back type-${type}`;
  elements.cardBadge.textContent = type === 'truth' ? '真心话 (Truth)' : (type === 'dare' ? '大冒险 (Dare)' : '极度惩罚 (Forfeit)');
  
  // 星星数量展示热度级
  let starsHTML = '';
  const starCount = type === 'penalty' ? 4 : state.heatLevel;
  for (let i = 0; i < starCount; i++) {
    starsHTML += `<i data-lucide="star"></i>`;
  }
  elements.cardStars.innerHTML = starsHTML;
  
  // 模板占位符解析
  elements.cardPrompt.innerHTML = parsePrompt(text);
  lucide.createIcons();
}

/**
 * 认罚：随机抽取惩罚
 */
function drawPenalty() {
  playSound('penalty');
  
  let sourceList = [...PENALTY_DATABASE];
  let availableList = sourceList.filter(item => !state.history.penalty.includes(item));
  if (availableList.length === 0) {
    state.history.penalty = [];
    availableList = sourceList;
  }
  
  const randomIndex = Math.floor(Math.random() * availableList.length);
  const selectedText = availableList[randomIndex];
  state.history.penalty.push(selectedText);
  
  state.currentCard = {
    type: 'penalty',
    text: selectedText,
    isFlipped: true
  };
  
  // 重新渲染卡片
  renderCardBack('penalty', selectedText);
  
  // 展示“跳过惩罚”按钮，隐藏完成
  elements.btnSkipPenalty.classList.remove('hidden');
}

// ==========================================================================
// 6. 事件绑定与人机交互
// ==========================================================================

function bindEvents() {
  // A. 设置面板性别按钮点击
  elements.p1Genders.forEach(btn => {
    btn.addEventListener('click', function() {
      playSound('click');
      elements.p1Genders.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      state.players[0].gender = this.dataset.gender;
      state.players[0].pronoun = getPronounByGender(this.dataset.gender);
    });
  });
  
  elements.p2Genders.forEach(btn => {
    btn.addEventListener('click', function() {
      playSound('click');
      elements.p2Genders.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      state.players[1].gender = this.dataset.gender;
      state.players[1].pronoun = getPronounByGender(this.dataset.gender);
    });
  });
  
  // B. 滑块拖动事件
  elements.heatSlider.addEventListener('input', function() {
    state.heatLevel = parseInt(this.value);
    updateHeatUI(state.heatLevel);
    playSound('level_change', state.heatLevel);
  });
  
  // C. 主界面快捷修改热度级别
  elements.quickHeatBadge.addEventListener('click', function() {
    playSound('click');
    elements.drawerOverlay.classList.add('active');
    elements.drawer.classList.add('active');
  });
  
  // D. 抽屉控制
  elements.btnOpenDrawer.addEventListener('click', function() {
    playSound('click');
    elements.drawerOverlay.classList.add('active');
    elements.drawer.classList.add('active');
  });
  
  elements.btnCloseDrawer.addEventListener('click', function() {
    playSound('click');
    elements.drawerOverlay.classList.remove('active');
    elements.drawer.classList.remove('active');
  });
  
  elements.drawerOverlay.addEventListener('click', function() {
    elements.drawerOverlay.classList.remove('active');
    elements.drawer.classList.remove('active');
  });
  
  // E. 声音开关
  elements.btnSoundToggle.addEventListener('click', function() {
    state.soundEnabled = !state.soundEnabled;
    this.classList.toggle('active', state.soundEnabled);
    if (state.soundEnabled) {
      this.innerHTML = `<i data-lucide="volume-2"></i>`;
      playSound('click');
    } else {
      this.innerHTML = `<i data-lucide="volume-x"></i>`;
    }
    lucide.createIcons();
  });
  
  // F. 添加自定义题目
  elements.btnAddCustom.addEventListener('click', function() {
    const text = elements.customText.value.trim();
    if (!text) return;
    
    let type = 'truth';
    elements.customType.forEach(radio => {
      if (radio.checked) type = radio.value;
    });
    
    state.customPool.push({ type, text });
    localStorage.setItem('qd_custom_pool', JSON.stringify(state.customPool));
    
    elements.customText.value = '';
    playSound('success');
    renderCustomItems();
  });
  
  // G. 开始游戏按钮
  elements.btnStart.addEventListener('click', function() {
    const name1 = elements.p1Name.value.trim() || '亲爱的他';
    const name2 = elements.p2Name.value.trim() || '小宝贝';
    
    state.players[0].name = name1;
    state.players[1].name = name2;
    
    // 保存至本地
    try {
      localStorage.setItem('qd_p1_name', name1);
      localStorage.setItem('qd_p1_gender', state.players[0].gender);
      localStorage.setItem('qd_p2_name', name2);
      localStorage.setItem('qd_p2_gender', state.players[1].gender);
      localStorage.setItem('qd_heat_level', state.heatLevel);
    } catch (e) {}
    
    playSound('start_game');
    
    // 切换屏幕
    elements.setupScreen.style.display = 'none';
    elements.gameScreen.style.display = 'block';
    state.screen = 'play';
    
    // 渲染主游戏状态
    state.activePlayerIdx = 0; // P1先开始
    elements.turnName.textContent = state.players[0].name;
    elements.turnAvatar.classList.remove('partner-turn');
    elements.turnAvatar.innerHTML = `<i data-lucide="heart"></i>`;
    
    // 快捷热度联动
    elements.quickHeatText.textContent = `LV.${state.heatLevel}`;
    
    resetCardState();
    lucide.createIcons();
  });
  
  // H. 真心话 & 大冒险 抽卡事件
  elements.btnTruth.addEventListener('click', () => drawCard('truth'));
  elements.btnDare.addEventListener('click', () => drawCard('dare'));
  
  // I. 任务结案按钮
  elements.btnDone.addEventListener('click', function() {
    playSound('success');
    switchTurn();
    resetCardState();
  });
  
  // J. 认罚按钮
  elements.btnForfeit.addEventListener('click', function() {
    drawPenalty();
  });
  
  // K. 认罚完成（跳过惩罚）按钮
  elements.btnSkipPenalty.addEventListener('click', function() {
    playSound('success');
    switchTurn();
    resetCardState();
  });
  
  // L. 倾听卡片背面点击（若未翻转，点击可翻转）
  elements.cardContainer.addEventListener('click', function() {
    if (state.currentCard && !state.currentCard.isFlipped) {
      flipCard();
    }
  });

  // M. Card 3D 悬浮倾斜动效 (3D Parallax Tilt)
  elements.cardContainer.addEventListener('mousemove', function(e) {
    const rect = elements.cardContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // 最大偏转15度
    const rotateX = -((y - centerY) / centerY) * 15;
    const rotateY = ((x - centerX) / centerX) * 15;
    
    if (elements.cardInner.classList.contains('is-flipped')) {
      elements.cardInner.style.transform = `rotateY(180deg) rotateX(${rotateX}deg) rotateY(${-rotateY}deg) scale(1.04)`;
    } else {
      elements.cardInner.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.04)`;
    }
  });

  elements.cardContainer.addEventListener('mouseleave', function() {
    if (elements.cardInner.classList.contains('is-flipped')) {
      elements.cardInner.style.transform = 'rotateY(180deg)';
    } else {
      elements.cardInner.style.transform = 'none';
    }
  });
}

// ==========================================================================
// 7. 初始化启动
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initDOMElements();
  bindEvents();
  loadFromLocalStorage();
  initCanvasParticles();
  
  // 渲染 Lucide CDN 图标
  lucide.createIcons();
});
