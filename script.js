// --- AUDIO ENGINE ---
let audioCtx;
function playSound(f, d) {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.setValueAtTime(f, audioCtx.currentTime);
        g.gain.setValueAtTime(0.05, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + d);
        o.start(); o.stop(audioCtx.currentTime + d);
    } catch(e) {}
}

// --- HELPER ---
function toYMD(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// --- DATA ---
const KEY = 'test_os_v6_1_data';
let state = { exams: [], plan: {} };
let isPlanEditing = false; 

function load() {
    const saved = localStorage.getItem(KEY);
    if (saved) state = JSON.parse(saved);
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(state));
    } catch(e) {
        console.error('Storage Save Error', e);
    }
    render();
}

// --- UI ---
function switchView(id) {
    playSound(600, 0.1);
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('nav div').forEach(n => n.classList.remove('active'));
    const target = document.getElementById(`view-${id}`);
    if (target) {
        target.classList.add('active');
        document.getElementById(`nav-${id}`).classList.add('active');
    }
}

function toggleMode() {
    const m = document.getElementById('in-mode').value;
    document.getElementById('ui-range').style.display = m === 'range' ? 'block' : 'none';
    document.getElementById('ui-vol').style.display = m === 'vol' ? 'block' : 'none';
    document.getElementById('ui-list').style.display = m === 'list' ? 'block' : 'none';
}

function togglePlanEdit() {
    isPlanEditing = !isPlanEditing;
    const btn = document.getElementById('btn-edit-plan');
    btn.innerText = isPlanEditing ? '✔ 完了' : '✎ 編集';
    if (!isPlanEditing) playSound(800, 0.1);
    render();
}

function updatePlanManual(date, idx, value) {
    if (state.plan[date] && state.plan[date][idx]) {
        state.plan[date][idx].desc = value;
        localStorage.setItem(KEY, JSON.stringify(state));
    }
}

// --- LOGIC ---
function addMaterial() {
    const sub = document.getElementById('in-sub').value.trim();
    const date = document.getElementById('in-date').value;
    if (!sub || !date) return alert('科目名と日付を入力してください');

    // 曜日取得ロジック（堅牢版）
    let selectedDays = Array.from(document.querySelectorAll('#sys-days input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
    if (selectedDays.length === 0) {
        const activeView = document.querySelector('.view.active');
        if (activeView) {
            selectedDays = Array.from(activeView.querySelectorAll('input[type="checkbox"]:checked')).map(cb => parseInt(cb.value));
        }
    }

    if (selectedDays.length === 0) {
        return alert('教材を学習する曜日を1つ以上選択してください');
    }

    let exam = state.exams.find(e => e.subject === sub && e.date === date);
    if (!exam) {
        exam = { id: Date.now(), subject: sub, date: date, materials: [] };
        state.exams.push(exam);
    }

    const mode = document.getElementById('in-mode').value;
    const rounds = parseInt(document.getElementById('in-rounds').value) || 1;
    const mId = Date.now() + Math.floor(Math.random() * 10000);

    let newMat;
    const common = { id: mId, rounds, days: selectedDays };

    if (mode === 'range') {
        let val = document.getElementById('in-val-range').value;
        val = val.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).replace(/\s+/g, '');
        const m = val.match(/^(\d+)[-〜~ー](\d+)$/);
        if (!m) return alert('範囲は 1-100 の形式で入力してください');
        newMat = { ...common, type: 'range', name: document.getElementById('in-name-range').value || '教材', start: parseInt(m[1]), end: parseInt(m[2]), doneRounds: new Array(rounds).fill(0), unit: document.getElementById('in-unit-range').value };
    } else if (mode === 'vol') {
        let val = document.getElementById('in-val-vol').value.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
        const total = parseInt(val);
        if (!total) return alert('合計件数を入力してください');
        newMat = { ...common, type: 'vol', name: document.getElementById('in-name-vol').value || '教材', total, doneRounds: new Array(rounds).fill(0), unit: document.getElementById('in-unit-vol').value };
    } else {
        const items = document.getElementById('in-val-list').value.split(/[,、\n]/).filter(s => s.trim());
        if (items.length === 0) return alert('項目を入力してください');
        newMat = { ...common, type: 'list', name: document.getElementById('in-name-list').value || '教材', items: items.map(l => ({ l: l.trim(), d: 0 })) };
    }

    exam.materials.push(newMat);
    playSound(800, 0.2);
    save(); 
    alert('教材を登録しました');
}

function generatePlan() {
    if (state.exams.length === 0) return alert('先に教材を登録してください');
    
    playSound(400, 0.5);
    document.getElementById('loading').style.display = 'flex';

    setTimeout(() => {
        try {
            state.plan = {};
            const startDateInput = document.getElementById('sys-start-date').value;
            let globalStart = startDateInput ? new Date(startDateInput) : new Date();
            globalStart.setHours(0,0,0,0);

            state.exams.forEach(exam => {
                const [ey, em, ed] = exam.date.split('-').map(Number);
                const endDate = new Date(ey, em - 1, ed);
                endDate.setHours(0,0,0,0);
                
                exam.materials.forEach(mat => {
                    const matDays = (mat.days && mat.days.length > 0) ? mat.days : [0,1,2,3,4,5,6];
                    let availableDates = [];
                    let curDate = new Date(globalStart);
                    while (curDate <= endDate) {
                        if (matDays.includes(curDate.getDay())) {
                            availableDates.push(new Date(curDate));
                        }
                        curDate.setDate(curDate.getDate() + 1);
                    }
                    if (availableDates.length === 0) availableDates.push(new Date(globalStart));
                    const daysCount = availableDates.length;

                    if (mat.type === 'list') {
                        let queue = [];
                        for (let r = 1; r <= mat.rounds; r++) {
                            mat.items.forEach(it => { if (it.d < r) queue.push({ l: it.l, r: r }); });
                        }
                        const perDay = Math.ceil(queue.length / daysCount);
                        let cur = 0;
                        for (let i=0; i<daysCount && cur<queue.length; i++) {
                            const k = toYMD(availableDates[i]);
                            if (!state.plan[k]) state.plan[k] = [];
                            for (let j=0; j<perDay && cur<queue.length; j++) {
                                if (queue[cur]) {
                                    const t = queue[cur++];
                                    state.plan[k].push({ sub: exam.subject, mat: mat.name, desc: t.l, info: `${t.r}周目`, id: mat.id });
                                }
                            }
                        }
                    } else {
                        let unitsPerRound = (mat.type === 'range' ? (mat.end - mat.start + 1) : mat.total);
                        if (!mat.doneRounds) mat.doneRounds = new Array(mat.rounds).fill(0);

                        let queue = [];
                        for (let r=0; r<mat.rounds; r++) {
                            let rem = unitsPerRound - (mat.doneRounds[r] || 0);
                            if (rem > 0) {
                                queue.push({ r: r+1, start: mat.type === 'range' ? (mat.start + (mat.doneRounds[r]||0)) : null, rem });
                            }
                        }

                        let totalRem = queue.reduce((sum, q) => sum + q.rem, 0);
                        if (totalRem > 0) {
                            const perDay = Math.ceil(totalRem / daysCount);
                            let qIdx = 0;
                            for (let i=0; i<daysCount && qIdx < queue.length; i++) {
                                const k = toYMD(availableDates[i]);
                                if (!state.plan[k]) state.plan[k] = [];
                                let dayRem = perDay;
                                while (dayRem > 0 && qIdx < queue.length) {
                                    let q = queue[qIdx];
                                    let amt = Math.min(dayRem, q.rem);
                                    let descText = mat.type === 'range' ? `${q.start}〜${q.start + amt - 1}${mat.unit||''}` : `${amt}${mat.unit||''}`;
                                    if (mat.type === 'range') q.start += amt;
                                    state.plan[k].push({ sub: exam.subject, mat: mat.name, desc: descText, info: `${q.r}周目`, id: mat.id });
                                    q.rem -= amt; dayRem -= amt;
                                    if (q.rem <= 0) qIdx++;
                                }
                            }
                        }
                    }
                });
            });
            save();
            document.getElementById('loading').style.display = 'none';
            playSound(1000, 0.3);
            switchView('home');
        } catch (e) {
            document.getElementById('loading').style.display = 'none';
            console.error(e);
            alert('エラーが発生しました');
        }
    }, 500);
}

function updateProg(matId, itIdx, val) {
    const m = findMat(matId);
    if (!m) return;
    if (m.type === 'list') {
        const r = parseInt(val) || 0;
        if (itIdx === -1) m.items.forEach(it => it.d = r);
        else m.items[itIdx].d = r;
    } else {
        let parsed = 0;
        if (m.type === 'range' && typeof val === 'string' && val.match(/\d+[-〜~ー]\d+/)) {
            let parts = val.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0)).split(/[-〜~ー]/);
            parsed = (parseInt(parts[1]) - m.start + 1) || 0;
        } else {
            parsed = parseInt(val) || 0;
        }
        if (itIdx > 0) {
            if (!m.doneRounds) m.doneRounds = new Array(m.rounds).fill(0);
            while(m.doneRounds.length < m.rounds) m.doneRounds.push(0);
            m.doneRounds[itIdx-1] = Math.max(0, parsed);
        }
    }
    save();
}

function deleteMat(eId, mId) {
    if(!confirm('削除しますか？')) return;
    const e = state.exams.find(ex => ex.id === eId);
    if (e) e.materials = e.materials.filter(m => m.id !== mId);
    Object.keys(state.plan).forEach(k => state.plan[k] = state.plan[k].filter(t => t.id !== mId));
    save();
}

function findMat(id) {
    for (let e of state.exams) for (let m of e.materials) if (m.id == id) return m;
    return null;
}

function render() {
    const today = toYMD(new Date()); 
    const hasPlan = Object.keys(state.plan).length > 0;
    document.getElementById('main-plan-btn').innerText = hasPlan ? '⚡ 進捗状況を解析し、AIが計画を再構築' : '✨ AI学習計画を新規生成する';

    let tAll = 0, tDone = 0;
    state.exams.forEach(e => e.materials.forEach(m => {
        if (m.type === 'list') { 
            tAll += m.items.length * m.rounds; 
            tDone += m.items.reduce((s,i)=>s+i.d, 0); 
        } else { 
            let units = (m.type==='range'?(m.end-m.start+1):m.total);
            tAll += units * m.rounds; 
            tDone += (m.doneRounds || []).reduce((a,b)=>a+b, 0);
        }
    }));
    document.getElementById('stat-progress').innerText = Math.floor((tDone/(tAll||1))*100) + '%';
    
    if (state.exams.length) {
        const dates = state.exams.map(e => new Date(e.date));
        const diff = Math.ceil((Math.min(...dates) - new Date().setHours(0,0,0,0)) / 86400000);
        document.getElementById('stat-days').innerText = Math.max(0, diff) + '日';
    }

    const tasks = state.plan[today] || [];
    document.getElementById('today-list').innerHTML = tasks.length ? tasks.map(t => `<div class="item-row"><div><small>${t.sub}</small><br><b>${t.mat}: ${t.desc}</b></div><span class="status-tag">${t.info}</span></div>`).join('') : '<p style="text-align:center; opacity:0.5;">予定なし</p>';

    document.getElementById('registered-list').innerHTML = state.exams.map(e => e.materials.map(m => `<div class="item-row"><div><small>${e.subject}</small><br><b>${m.name}</b></div><button class="danger" onclick="deleteMat(${e.id}, ${m.id})">削除</button></div>`).join('')).join('') || '<p style="opacity:0.5;">登録なし</p>';

    // --- 進捗入力エリアの修正 ---
    document.getElementById('progress-input-area').innerHTML = state.exams.map(e => e.materials.map(m => {
        if (m.type === 'list') {
            return `<div class="glass-card"><h3>${m.name}</h3><div class="item-row"><span>一括</span><input type="number" onchange="updateProg(${m.id},-1,this.value)" style="width:80px;"><span>周</span></div>${m.items.map((it, idx) => `<div class="item-row"><span>${it.l}</span><input type="number" value="${it.d}" onchange="updateProg(${m.id},${idx},this.value)" style="width:60px;"></div>`).join('')}</div>`;
        } else {
            let drs = m.doneRounds || new Array(m.rounds).fill(0);
            let infoText = m.type === 'range' ? `全体範囲: ${m.start}〜${m.end}` : `全体量: ${m.total}`;
            return `<div class="glass-card"><h3>${m.name}</h3>
                <div style="font-size: 0.8rem; color: #a0aec0; margin-bottom: 8px;">${infoText} ${m.unit||''}</div>
                ${drs.map((dr, idx) => {
                    let val = dr;
                    if(m.type === 'range' && dr > 0) val = `${m.start}-${m.start + dr - 1}`;
                    return `<div class="item-row"><span>${idx+1}周目</span><input type="${m.type==='range'?'text':'number'}" value="${val}" onchange="updateProg(${m.id},${idx+1},this.value)" style="width:100px;"><span>${m.type==='range'?'':(m.unit||'')}</span></div>`
                }).join('')}</div>`;
        }
    }).join('')).join('') || '<p style="opacity:0.5;">登録なし</p>';

    let planHtml = '';
    Object.keys(state.plan).sort().forEach(d => {
        planHtml += `<h4 style="color:var(--accent); border-bottom:1px solid #333; margin-bottom:10px; margin-top:20px;">${d}</h4>`;
        state.plan[d].forEach((t, idx) => {
            const content = isPlanEditing ? `<input type="text" class="plan-edit-input" value="${t.desc}" oninput="updatePlanManual('${d}', ${idx}, this.value)">` : `<b>${t.mat}: ${t.desc}</b>`;
            planHtml += `<div class="item-row"><div style="flex: 1;"><small>${t.sub}</small><br>${content}</div><span class="status-tag">${t.info}</span></div>`;
        });
    });
    document.getElementById('full-plan-area').innerHTML = planHtml || '<p style="opacity:0.5;">計画がありません</p>';
}

window.onload = () => {
    load();
    document.getElementById('sys-start-date').value = toYMD(new Date());
    render();
    if ('serviceWorker' in navigator) {
        const sw = "self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>{});";
        navigator.serviceWorker.register(URL.createObjectURL(new Blob([sw], {type: 'application/javascript'}))).catch(()=>{});
    }
};

window.addEventListener('beforeunload', save);
window.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
