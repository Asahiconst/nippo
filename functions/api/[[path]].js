import { getCurrentUser, createSession, destroySession, sessionCookie, clearCookie, json, unauthorized, forbidden, getCookie } from '../_lib/auth.js';
import { verifyPassword, hashPassword } from '../_lib/hash.js';
import { isValidDateKey, isValidYm } from '../_lib/dateutil.js';
import * as Gyoumu from '../_lib/gyoumu.js';
import * as Gpop from '../_lib/gpop.js';
import * as Genba from '../_lib/genba.js';
import * as Shukkan from '../_lib/shukkan.js';
import * as Unten from '../_lib/unten.js';
import * as Users from '../_lib/users.js';
import * as Admin from '../_lib/admin.js';

export async function onRequest(context) {
  const { request, env, params } = context;
  const method = request.method;
  const segs = params.path || [];
  const p = segs.join('/');
  const url = new URL(request.url);
  const q = url.searchParams;

  try {
    // ===== 認証不要 =====
    if (p === 'login' && method === 'POST') {
      const body = await request.json();
      const user = await env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(String(body.id || '')).first();
      if (!user || !(await verifyPassword(String(body.password || ''), user.password_hash))) {
        return json({ success: false, message: 'IDまたはパスワードが間違っています。' });
      }
      const { token, maxAge } = await createSession(env, user.id);
      return json(
        { success: true, id: user.id, role: user.role, name: user.name, busho: user.busho },
        { headers: { 'Set-Cookie': sessionCookie(token, maxAge), 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (p === 'images' || p.startsWith('images/')) {
      if (method !== 'GET') return json({ success: false }, { status: 405 });
      const key = segs.slice(1).join('/');
      const obj = await env.IMAGES.get(key);
      if (!obj) return new Response('Not found', { status: 404 });
      return new Response(obj.body, {
        headers: {
          'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
          'Cache-Control': 'public, max-age=31536000, immutable'
        }
      });
    }

    // ===== ここから要ログイン =====
    const user = await getCurrentUser(request, env);

    if (p === 'me' && method === 'GET') {
      if (!user) return unauthorized();
      return json({ success: true, user });
    }

    if (p === 'logout' && method === 'POST') {
      await destroySession(env, getCookie(request, 'session'));
      return json({ success: true }, { headers: { 'Set-Cookie': clearCookie() } });
    }

    if (!user) return unauthorized();
    const isAdmin = user.role === '管理者';

    if (p === 'change-password' && method === 'POST') {
      const body = await request.json();
      const row = await env.DB.prepare('SELECT password_hash FROM users WHERE id = ?').bind(user.id).first();
      if (!row || !(await verifyPassword(String(body.oldPassword || ''), row.password_hash))) {
        return json({ success: false, message: '現在のパスワードが間違っています。' });
      }
      const hash = await hashPassword(String(body.newPassword || ''));
      await env.DB.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, user.id).run();
      return json({ success: true });
    }

    // ===== ユーザー =====
    if (p === 'users' && method === 'GET') return json(await Users.getAll(env));
    if (p === 'users/full' && method === 'GET') {
      if (!isAdmin) return forbidden();
      return json(await Users.getFull(env));
    }
    if (p === 'users' && method === 'POST') {
      if (!isAdmin) return forbidden();
      return json(await Users.add(env, await request.json()));
    }
    if (p === 'users/reorder' && method === 'POST') {
      if (!isAdmin) return forbidden();
      const body = await request.json();
      return json(await Users.reorder(env, body.ids));
    }
    if (segs[0] === 'users' && segs.length === 2 && method === 'PUT') {
      if (!isAdmin) return forbidden();
      return json(await Users.update(env, segs[1], await request.json()));
    }
    if (segs[0] === 'users' && segs.length === 2 && method === 'DELETE') {
      if (!isAdmin) return forbidden();
      return json(await Users.remove(env, segs[1]));
    }

    // ===== 業務改善日報 =====
    if (p === 'gyoumu/dates' && method === 'GET') return json(await Gyoumu.getDates(env, q.get('empId')));
    if (p === 'gyoumu/mine' && method === 'GET') return json(await Gyoumu.getByDateForEmp(env, q.get('empId'), q.get('date')));
    if (p === 'gyoumu/by-date' && method === 'GET') return json(await Gyoumu.getByDateAll(env, q.get('date')));
    if (p === 'gyoumu/month' && method === 'GET') return json(await Gyoumu.getDaysInMonth(env, q.get('year'), q.get('month')));
    if (p === 'gyoumu' && method === 'POST') {
      const b = await request.json();
      if (!isValidDateKey(b.dateKey)) return json({ success: false, message: '日付が不正です。' });
      return json(await Gyoumu.save(env, user.id, user.name, user.busho, b.dateKey, b.fields));
    }
    if (p === 'gyoumu' && method === 'DELETE') return json(await Gyoumu.remove(env, user.id, q.get('date')));

    // ===== G-POP =====
    if (p === 'gpop/dates' && method === 'GET') return json(await Gpop.getDates(env, q.get('empId')));
    if (p === 'gpop/mine' && method === 'GET') return json(await Gpop.getMyByDate(env, q.get('empId'), q.get('date')));
    if (p === 'gpop/by-date' && method === 'GET') return json(await Gpop.getByDateAll(env, q.get('date')));
    if (p === 'gpop/month' && method === 'GET') return json(await Gpop.getDaysInMonth(env, q.get('year'), q.get('month')));
    if (p === 'gpop' && method === 'POST') {
      const b = await request.json();
      if (!isValidDateKey(b.dateKey)) return json({ success: false, message: '日付が不正です。' });
      return json(await Gpop.save(env, user.id, user.name, user.busho, b.dateKey, b.fields));
    }
    if (p === 'gpop' && method === 'DELETE') return json(await Gpop.remove(env, user.id, q.get('date')));

    // ===== 現場管理日報 =====
    if (p === 'genba/dates' && method === 'GET') return json(await Genba.getDates(env, q.get('empId')));
    if (p === 'genba/mine' && method === 'GET') return json(await Genba.getMyByDate(env, q.get('empId'), q.get('date')));
    if (p === 'genba/by-date' && method === 'GET') return json(await Genba.getByDateAll(env, q.get('date')));
    if (p === 'genba/month' && method === 'GET') return json(await Genba.getDaysInMonth(env, q.get('year'), q.get('month')));
    if (p === 'genba/sites' && method === 'GET') return json(await Genba.getSitesInMonth(env, q.get('year'), q.get('month')));
    if (p === 'genba/upload' && method === 'POST') {
      const b = await request.json();
      if (!isValidDateKey(b.dateKey)) return json({ success: false, message: '日付が不正です。' });
      const key = await Genba.saveImage(env, user.id, b.dateKey, b.slot, b.image);
      return json({ success: true, key });
    }
    if (p === 'genba' && method === 'POST') {
      const b = await request.json();
      if (!isValidDateKey(b.dateKey)) return json({ success: false, message: '日付が不正です。' });
      return json(await Genba.save(env, user.id, user.name, user.busho, b.dateKey, b.data, b.money, b.images));
    }
    if (p === 'genba' && method === 'DELETE') return json(await Genba.remove(env, user.id, q.get('date')));

    // ===== 出勤簿 =====
    if (p === 'shukkan' && method === 'GET') return json(await Shukkan.get(env, q.get('empId'), q.get('ym')));
    if (p === 'shukkan/months' && method === 'GET') return json(await Shukkan.getMonths(env, q.get('empId')));
    if (p === 'shukkan/all' && method === 'GET') {
      if (!isAdmin) return forbidden();
      return json(await Shukkan.getMonthAll(env, q.get('ym')));
    }
    if (p === 'shukkan' && method === 'POST') {
      const b = await request.json();
      if (!isValidYm(b.yearMonth)) return json({ success: false, message: '対象月が不正です。' });
      const empId = isAdmin && b.empId ? b.empId : user.id;
      const name = isAdmin && b.empId ? (b.name || empId) : user.name;
      return json(await Shukkan.save(env, empId, name, b.yearMonth, b.rows));
    }
    if (p === 'shukkan' && method === 'DELETE') return json(await Shukkan.remove(env, user.id, q.get('ym')));

    // ===== 運転日報 =====
    if (p === 'unten' && method === 'GET') return json(await Unten.get(env, q.get('empId'), q.get('ym')));
    if (p === 'unten/months' && method === 'GET') return json(await Unten.getMonths(env, q.get('empId')));
    if (p === 'unten/all' && method === 'GET') {
      if (!isAdmin) return forbidden();
      return json(await Unten.getMonthAll(env, q.get('ym')));
    }
    if (p === 'unten' && method === 'POST') {
      const b = await request.json();
      if (!isValidYm(b.yearMonth)) return json({ success: false, message: '対象月が不正です。' });
      const empId = isAdmin && b.empId ? b.empId : user.id;
      const name = isAdmin && b.empId ? (b.name || empId) : user.name;
      return json(await Unten.save(env, empId, name, b.yearMonth, b.rows));
    }
    if (p === 'unten' && method === 'DELETE') return json(await Unten.remove(env, user.id, q.get('ym')));

    // ===== お知らせメッセージ =====
    if (p === 'settings/message' && method === 'GET') return json({ message: await Admin.getSetting(env, 'appMessage') });
    if (p === 'settings/message' && method === 'POST') {
      if (!isAdmin) return forbidden();
      const b = await request.json();
      return json(await Admin.setSetting(env, 'appMessage', b.html));
    }

    // ===== 特別日 =====
    if (p === 'special-days' && method === 'GET') return json(await Admin.getSpecialDays(env));
    if (p === 'special-days' && method === 'POST') {
      if (!isAdmin) return forbidden();
      const b = await request.json();
      return json(await Admin.addSpecialDay(env, b.date, b.type, b.name));
    }
    if (segs[0] === 'special-days' && segs.length === 2 && method === 'DELETE') {
      if (!isAdmin) return forbidden();
      return json(await Admin.deleteSpecialDay(env, decodeURIComponent(segs[1])));
    }

    // ===== 管理者：対象社員選択の記憶 =====
    if (p === 'mgmt-selection' && method === 'GET') {
      if (!isAdmin) return forbidden();
      return json(await Admin.getMgmtSelection(env, q.get('type')));
    }
    if (p === 'mgmt-selection' && method === 'POST') {
      if (!isAdmin) return forbidden();
      const b = await request.json();
      return json(await Admin.saveMgmtSelection(env, b.type, b.ids));
    }

    return json({ success: false, message: 'Not found' }, { status: 404 });
  } catch (err) {
    return json({ success: false, message: String(err && err.message || err) }, { status: 500 });
  }
}
