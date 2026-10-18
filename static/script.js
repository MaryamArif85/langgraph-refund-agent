let currentIntent = 'refund';
let lastThreadId = null;

document.querySelectorAll('.chips button').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.chips button').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    currentIntent = btn.dataset.intent;
    const msg = document.getElementById('message');
    if(currentIntent==='refund') msg.placeholder = 'I want refund for ORD-1001, delivered 2 days ago...';
    if(currentIntent==='tracking') msg.placeholder = 'Where is my order ORD-1001?';
    if(currentIntent==='cancellation') msg.placeholder = 'I want to cancel ORD-1001';
    if(currentIntent==='complaint') msg.placeholder = 'I have an issue with ORD-1001';
  });
});

function setProgress(step){
  const ids = ['p-intent','p-order','p-policy','p-decision'];
  ids.forEach(id=> document.getElementById(id).className='p-step');
  if(step==='intent') document.getElementById('p-intent').classList.add('active');
  if(step==='order'){ document.getElementById('p-intent').classList.add('done'); document.getElementById('p-order').classList.add('active'); }
  if(step==='policy'){ ['p-intent','p-order'].forEach(i=>document.getElementById(i).classList.add('done')); document.getElementById('p-policy').classList.add('active'); }
  if(step==='decision'){ ids.forEach(i=>document.getElementById(i).classList.add('done')); }
}

function addMsg(text, who='bot', extra=''){
  const area = document.getElementById('chatArea');
  const div = document.createElement('div');
  div.className = `msg ${who} ${extra}`;
  div.innerHTML = text;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

document.getElementById('sendBtn').addEventListener('click', async()=>{
  let orderId = document.getElementById('orderId').value.trim().toUpperCase();
  let message = document.getElementById('message').value.trim();
  if(!message){ alert('Type your message'); return; }
  if(orderId && !message.toUpperCase().includes(orderId)){
    message = `${message} Order ID ${orderId}`;
  }
  const threadId = 'thread-' + Date.now();
  lastThreadId = threadId;
  document.getElementById('threadDisplay').innerText = threadId;
  document.getElementById('tracker').style.display = 'block';
  setProgress('intent');
  addMsg(message,'user');
  document.getElementById('chatBubble').innerText = 'Classifying intent: ' + currentIntent + '...';

  try{
    const res = await fetch('/support',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({message, thread_id: threadId})
    });
    const data = await res.json();
    if(res.status===409){ addMsg('Thread exists, refresh and try again.','bot'); return; }
    
    setProgress('order');
    await new Promise(r=>setTimeout(r,500));
    setProgress('policy');
    document.getElementById('chatBubble').innerText = 'Checking order and 7-day policy...';
    await new Promise(r=>setTimeout(r,600));
    setProgress('decision');

    if(data.status==='awaiting_approval'){
      const q = data.interrupts?.[0]?.question || 'Approve this refund?';
      addMsg(`<b>Human Review Required</b><br>${data.decision} - Amount > $100<br>Thread: <code>${data.thread_id}</code><br><small>${q}</small><div class='review-actions'><button class='btn-approve' onclick="doReview('${data.thread_id}',true)">Approve</button><button class='btn-reject' onclick="doReview('${data.thread_id}',false)">Reject</button></div>`,'bot','review');
      document.getElementById('chatBubble').innerText = 'Needs human approval. Click Approve/Reject below.';
    } else {
      const cls = (data.decision==='recorded' || data.decision==='approved') ? 'approved' : '';
      addMsg(data.response || JSON.stringify(data),'bot',cls);
      document.getElementById('chatBubble').innerText = data.response ? 'Completed' : data.decision;
    }
  }catch(e){ addMsg('Error: '+e.message,'bot'); }
});

async function doReview(threadId, approved){
  addMsg(`Review decision: ${approved?'Approve':'Reject'} for ${threadId}`,'user');
  try{
    const res = await fetch(`/review/${threadId}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({approved})
    });
    const data = await res.json();
    addMsg(data.response,'bot', approved?'approved':'');
    document.getElementById('chatBubble').innerText = 'Review done: '+(approved?'Approved':'Rejected');
  }catch(e){ addMsg('Review error: '+e.message,'bot'); }
}

document.getElementById('message').addEventListener('keydown', e=>{
  if(e.key==='Enter') document.getElementById('sendBtn').click();
});
// Clear button logic
document.getElementById('clearBtn').addEventListener('click', ()=>{
  document.getElementById('chatArea').innerHTML = '';
  document.getElementById('tracker').style.display = 'none';
  document.getElementById('orderId').value = '';
  document.getElementById('message').value = '';
  document.getElementById('threadDisplay').innerText = '—';
  document.getElementById('chatBubble').innerText = '';
  // reset progress circles
  ['p-intent','p-order','p-policy','p-decision'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.className = 'p-step';
  });
  lastThreadId = null;
});