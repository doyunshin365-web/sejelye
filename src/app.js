const container = document.querySelector('.container');
const submit_btn = document.querySelector('#submit');
const usr_input = document.querySelector('#usr');
const name_input = document.querySelector('#name');

// 이 브라우저를 식별하기 위한 id (서버 메모리 기록을 브라우저별로 필터링하는 용도)
// crypto.randomUUID는 HTTPS/localhost가 아닌 환경(secure context 아님)에서는
// 지원되지 않아 undefined일 수 있으므로 직접 만든 폴백을 사용한다.
function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function getClientId() {
  let id = localStorage.getItem('clientId');
  if (!id) {
    id = generateId();
    localStorage.setItem('clientId', id);
  }
  return id;
}
const clientId = getClientId();

// 이름은 로컬에 저장해두고 다음 방문 때도 재사용
const savedName = localStorage.getItem('userName');
if (savedName) name_input.value = savedName;
name_input.addEventListener('change', () => {
  localStorage.setItem('userName', name_input.value.trim());
});

const askError = document.getElementById('ask-error');

async function evaluateMessage(userText, userName) {
  let res;
  try {
    res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { role: 'user', parts: [{ text: userText }] }
        ],
        name: userName,
        question: userText,
        clientId,
      }),
    });
  } catch (e) {
    throw new Error('서버에 연결할 수 없어요. 인터넷 연결을 확인해주세요.');
  }

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error || `채점 중 오류가 발생했어요. (${res.status})`);
  }

  let result;
  try {
    result = JSON.parse(data.text);
  } catch (e) {
    throw new Error('채점 결과를 읽는 데 실패했어요. 다시 시도해주세요.');
  }

  const stage_txt = container.querySelector('.stage');
  const lv_txt = container.querySelector('.lv');
  const detail_txt = container.querySelector('.detail');
  const advice_txt = container.querySelector('.advice');

  stage_txt.textContent = result.stage + "단계";
  lv_txt.textContent = result.lv + "점";
  detail_txt.textContent = result.detail;
  advice_txt.textContent = result.advice ? `💡 ${result.advice}` : '';
}

submit_btn.addEventListener('click', async () => {
  const usr = usr_input.value.trim();
  if (!usr) return;

  const userName = name_input.value.trim();
  localStorage.setItem('userName', userName);

  submit_btn.disabled = true;
  askError.textContent = '';
  usr_input.value = '';

  try {
    await evaluateMessage(usr, userName);
    await Promise.all([loadHistory(), loadLeaderboard()]);
  } catch (e) {
    console.error(e);
    askError.textContent = e.message || '알 수 없는 오류가 발생했어요.';
    usr_input.value = usr;
  } finally {
    submit_btn.disabled = false;
  }
});

usr_input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !submit_btn.disabled) {
    submit_btn.click();
  }
});

// ---------------- 탭 전환 ----------------

const tabButtons = document.querySelectorAll('.tabbar-item');
const panels = document.querySelectorAll('.tab-panel');

function switchTab(tab) {
  panels.forEach((p) => p.classList.toggle('active', p.dataset.panel === tab));
  tabButtons.forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));

  if (tab === 'history') loadHistory();
  if (tab === 'hof') loadLeaderboard();
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

switchTab('ask');

// ---------------- 질문 기록 ----------------

function stageLabel(stage) {
  const labels = { 1: '기억하기', 2: '이해하기', 3: '적용하기', 4: '분석하기', 5: '평가·창조하기' };
  return labels[stage] || '';
}

const historyList = document.getElementById('history-list');

async function loadHistory() {
  try {
    const res = await fetch(`/api/history?clientId=${encodeURIComponent(clientId)}`);
    const data = await res.json();
    const list = data.records || [];

    if (list.length === 0) {
      historyList.innerHTML = '<li class="empty-msg">아직 남긴 질문이 없어요.</li>';
      return;
    }

    historyList.innerHTML = list.map((r) => `
      <li class="history-item">
        <div class="history-item-top">
          <span class="history-q">${escapeHtml(r.question)}</span>
          <span class="history-lv">${r.lv}점</span>
        </div>
        <span class="history-stage">${r.stage}단계 (${stageLabel(r.stage)})</span>
        <p class="history-detail">${escapeHtml(r.detail || '')}</p>
        ${r.advice ? `<p class="history-advice">💡 ${escapeHtml(r.advice)}</p>` : ''}
      </li>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

// ---------------- 질문의 전당 ----------------

const hofList = document.getElementById('hof-list');

async function loadLeaderboard() {
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    const list = data.records || [];

    if (list.length === 0) {
      hofList.innerHTML = '<li class="empty-msg">아직 등록된 기록이 없어요.</li>';
      return;
    }

    const maxLv = list[0].lv || 1;

    hofList.innerHTML = list.map((r, i) => `
      <li class="hof-item">
        <div class="hof-rank">${i + 1}</div>
        <div class="hof-body">
          <div class="hof-top">
            <span class="hof-name">${escapeHtml(r.name)} 학생</span>
            <span class="hof-lv">${r.lv}점 (${r.stage}단계)</span>
          </div>
          <p class="hof-q">"${escapeHtml(r.question)}"</p>
          <div class="hof-bar-track">
            <div class="hof-bar-fill" style="width:${Math.max(4, (r.lv / maxLv) * 100)}%"></div>
          </div>
          <span class="hof-stage-badge">${r.stage}단계 (${stageLabel(r.stage)})</span>
        </div>
      </li>
    `).join('');
  } catch (e) {
    console.error(e);
  }
}

// ---------------- 리더보드 초기화 ----------------

const resetHofBtn = document.getElementById('reset-hof');
const resetModal = document.getElementById('reset-modal');
const resetPasswordInput = document.getElementById('reset-password');
const resetMask = document.getElementById('reset-mask');
const resetError = document.getElementById('reset-error');
const resetCancelBtn = document.getElementById('reset-cancel');
const resetConfirmBtn = document.getElementById('reset-confirm');

// 모바일 키보드는 type="password"여도 방금 입력한 마지막 글자를 잠깐 평문으로 보여준다.
// 화면 미러링 시 그대로 노출되므로, input을 마스크로 덮어 항상 점(•)만 보이게 한다.
resetPasswordInput.addEventListener('input', () => {
  resetMask.textContent = '•'.repeat(resetPasswordInput.value.length);
});

function openResetModal() {
  resetError.textContent = '';
  resetPasswordInput.value = '';
  resetMask.textContent = '';
  resetModal.hidden = false;
  resetPasswordInput.focus();
}

function closeResetModal() {
  resetModal.hidden = true;
}

resetHofBtn.addEventListener('click', openResetModal);
resetCancelBtn.addEventListener('click', closeResetModal);

resetModal.addEventListener('click', (e) => {
  if (e.target === resetModal) closeResetModal();
});

async function submitResetPassword() {
  const password = resetPasswordInput.value;
  resetError.textContent = '';
  resetConfirmBtn.disabled = true;

  try {
    const res = await fetch('/api/leaderboard/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();

    if (!res.ok) {
      resetError.textContent = data.error || '초기화에 실패했습니다.';
      return;
    }

    closeResetModal();
    await loadLeaderboard();
  } catch (e) {
    console.error(e);
    resetError.textContent = '초기화 중 오류가 발생했습니다.';
  } finally {
    resetConfirmBtn.disabled = false;
  }
}

resetConfirmBtn.addEventListener('click', submitResetPassword);
resetPasswordInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') submitResetPassword();
});

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
