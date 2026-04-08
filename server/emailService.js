import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import QRCode from 'qrcode';

dotenv.config();

const resolveEmailConfig = (config) => {
  const base = {
    brand_name: (process.env.BRAND_NAME || '').trim(),
    app_url: (process.env.APP_URL || '').trim(),
    admin_notify_email: (process.env.ADMIN_NOTIFY_EMAIL || '').trim(),
    bank_name: (process.env.BANK_NAME || '').trim(),
    bank_account: (process.env.BANK_ACCOUNT || '').trim(),
    bank_account_name: (process.env.BANK_ACCOUNT_NAME || '').trim(),
    smtp_host: (process.env.SMTP_HOST || '').trim(),
    smtp_port: Number(process.env.SMTP_PORT || 0) || 587,
    smtp_user: (process.env.SMTP_USER || '').trim(),
    smtp_pass: (process.env.SMTP_PASS || '').trim(),
    email_from: (process.env.EMAIL_FROM || '').trim(),
  };
  if (!config) return base;
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(config).filter(([, v]) => v !== undefined && v !== null),
    ),
  };
};

const getBrandName = (config) => {
  const c = resolveEmailConfig(config);
  return c.brand_name || 'Villa';
};

const getBankInfoHtml = (config) => {
  const c = resolveEmailConfig(config);
  const bankName = (c.bank_name || '').trim();
  const bankAccount = (c.bank_account || '').trim();
  const bankAccountName = (c.bank_account_name || '').trim();
  if (!bankName || !bankAccount || !bankAccountName) return '';
  return `<div style="background: white; padding: 10px; border-radius: 5px; font-family: monospace;">
            Bank ${bankName}: ${bankAccount}<br>
            A/N: ${bankAccountName}
          </div>`;
};

const transporterCache = new Map();
const getTransporter = (config) => {
  const c = resolveEmailConfig(config);
  const host = (c.smtp_host || '').trim();
  const port = Number(c.smtp_port || 0) || 587;
  const user = (c.smtp_user || '').trim();
  const pass = (c.smtp_pass || '').trim();
  const secure = port === 465;

  const cacheKey = JSON.stringify({ host, port, user, pass, secure });
  if (transporterCache.has(cacheKey)) return transporterCache.get(cacheKey);
  if (!host) {
    transporterCache.set(cacheKey, null);
    return null;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  transporterCache.set(cacheKey, transporter);
  return transporter;
};

const sendMail = async ({ to, subject, html, attachments }, config) => {
  const c = resolveEmailConfig(config);
  const transporter = getTransporter(c);
  if (!transporter) return false;
  const from = (c.email_from || '').trim();
  if (!from) return false;
  await transporter.sendMail({ from, to, subject, html, attachments });
  return true;
};

export const sendBookingReceipt = async (email, bookingDetails, config) => {
  const { room_name, check_in, check_out, guests, children, total_price, child_discount, payment_method, id } = bookingDetails;
  
  const formatPrice = (price) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  try {
    // Generate QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(id);
    const brandName = getBrandName(config);
    const bankInfoHtml = getBankInfoHtml(config);
    
    const mailOptions = {
      to: email,
      subject: `Struk Booking - ${room_name} (#${id.substring(0, 8)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #f97316; text-align: center;">Konfirmasi Booking</h2>
          <p>Halo,</p>
          <p>Terima kasih telah melakukan booking di <strong>${brandName}</strong>. Berikut adalah detail pesanan Anda:</p>
          
          <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Kamar:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${room_name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Check-in:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_in}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6b7280;">Check-out:</td>
                <td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_out}</td>
              </tr>
              <tr>
              <td style="padding: 8px 0; color: #6b7280;">Tamu:</td>
              <td style="padding: 8px 0; color: #6b7280; font-weight: bold; text-align: right;">${guests} Dewasa${children > 0 ? `, ${children} Anak` : ''}</td>
             </tr>
             ${child_discount > 0 ? `
             <tr>
               <td style="padding: 8px 0; color: #16a34a;">Potongan Anak:</td>
               <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">-${formatPrice(child_discount)}</td>
             </tr>
             ` : ''}
             <tr>
               <td style="padding: 8px 0; color: #6b7280;">Pembayaran:</td>
               <td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment_method}</td>
             </tr>
                <tr style="border-top: 1px solid #e5e7eb;">
                <td style="padding: 15px 0 8px; color: #6b7280; font-size: 18px;">Total Bayar:</td>
                <td style="padding: 15px 0 8px; font-weight: bold; text-align: right; color: #f97316; font-size: 20px;">${formatPrice(total_price)}</td>
              </tr>
            </table>
        </div>

        ${payment_method === 'Transfer Bank' ? `
        <div style="background-color: #fff7ed; padding: 15px; border-radius: 8px; border: 1px solid #ffedd5; margin-bottom: 20px;">
          <h4 style="margin-top: 0; color: #9a3412;">Instruksi Pembayaran:</h4>
          <p style="font-size: 13px; color: #431407; margin-bottom: 5px;">Silakan transfer tepat senilai <strong>${formatPrice(total_price)}</strong> ke rekening berikut:</p>
          ${bankInfoHtml || `<div style="background: white; padding: 10px; border-radius: 5px; font-family: monospace;">(Info rekening belum diatur)</div>`}
          <p style="font-size: 12px; color: #9a3412; margin-top: 10px;">* Konfirmasi pembayaran via WhatsApp Admin setelah transfer.</p>
        </div>
        ` : `
        <div style="background-color: #f0fdf4; padding: 15px; border-radius: 8px; border: 1px solid #dcfce7; margin-bottom: 20px;">
          <h4 style="margin-top: 0; color: #166534;">Bayar di Tempat:</h4>
          <p style="font-size: 13px; color: #14532d;">Silakan lakukan pembayaran saat Anda tiba di lokasi villa sesuai dengan total tagihan di atas.</p>
        </div>
        `}
        
        <div style="text-align: center; margin: 30px 0;">
            <p style="margin-bottom: 10px; color: #6b7280;">Scan QR Code ini saat check-in:</p>
            <img src="cid:booking_qr" alt="QR Code Booking" style="width: 150px; height: 150px; border: 1px solid #eee; padding: 10px; border-radius: 5px;" />
            <p style="font-size: 12px; color: #9ca3af; margin-top: 5px;">ID: ${id}</p>
          </div>
          
          <p style="font-size: 12px; color: #9ca3af; text-align: center; margin-top: 30px;">
            Harap tunjukkan email ini saat melakukan check-in.<br>
            Jika ada pertanyaan, hubungi admin kami.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: 'qrcode.png',
          content: qrCodeDataUrl.split(',')[1],
          encoding: 'base64',
          cid: 'booking_qr'
        }
      ]
    };

    await sendMail(mailOptions, config);
    return true;
  } catch (error) {
    console.error('Gagal memproses email atau QR Code:', error);
    return false;
  }
};

export const sendAdminNewBookingNotification = async (adminEmail, bookingDetails, config) => {
  const { room_name, check_in, check_out, guests, children, total_price, payment_method, id, guest_email } = bookingDetails;
  const brandName = getBrandName(config);
  const formatPrice = (price) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a; text-align: center;">Booking Baru</h2>
      <p>Booking baru masuk di <strong>${brandName}</strong>.</p>
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280;">ID:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${id}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Email Tamu:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${guest_email || '-'}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Kamar:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${room_name}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Check-in:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_in}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Check-out:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_out}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Tamu:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${guests} Dewasa${children > 0 ? `, ${children} Anak` : ''}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Pembayaran:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${payment_method}</td></tr>
          <tr style="border-top: 1px solid #e5e7eb;"><td style="padding: 15px 0 8px; color: #6b7280; font-size: 16px;">Total:</td><td style="padding: 15px 0 8px; font-weight: bold; text-align: right; color: #0f172a; font-size: 16px;">${formatPrice(total_price)}</td></tr>
        </table>
      </div>
    </div>
  `;

  try {
    await sendMail({ to: adminEmail, subject: `Booking Baru (#${id.substring(0, 8)})`, html }, config);
    return true;
  } catch (error) {
    console.error('Gagal kirim email admin:', error);
    return false;
  }
};

export const sendBookingReminder = async (email, bookingDetails, config) => {
  const { room_name, check_in, check_out, id } = bookingDetails;
  const c = resolveEmailConfig(config);
  const brandName = getBrandName(c);
  const appUrl = (c.app_url || '').trim();
  const link = appUrl ? `${appUrl.replace(/\/$/, '')}/bookings` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #f97316; text-align: center;">Reminder Check-in</h2>
      <p>Halo, ini pengingat bahwa Anda akan check-in di <strong>${brandName}</strong>.</p>
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Booking ID:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${id}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Kamar:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${room_name}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Check-in:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_in}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Check-out:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_out}</td></tr>
        </table>
      </div>
      ${link ? `<p style="text-align:center;"><a href="${link}" style="display:inline-block;background:#0f172a;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;">Lihat Booking Saya</a></p>` : ''}
    </div>
  `;

  try {
    await sendMail({ to: email, subject: `Reminder Check-in (#${id.substring(0, 8)})`, html }, c);
    return true;
  } catch (error) {
    console.error('Gagal kirim reminder:', error);
    return false;
  }
};

export const sendPostStayFollowup = async (email, bookingDetails, config) => {
  const { room_name, check_in, check_out, id } = bookingDetails;
  const c = resolveEmailConfig(config);
  const brandName = getBrandName(c);
  const appUrl = (c.app_url || '').trim();
  const link = appUrl ? `${appUrl.replace(/\/$/, '')}/profile` : '';

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a; text-align: center;">Terima Kasih</h2>
      <p>Terima kasih sudah menginap di <strong>${brandName}</strong>. Semoga nyaman.</p>
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; color: #6b7280;">Booking ID:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${id}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Kamar:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${room_name}</td></tr>
          <tr><td style="padding: 8px 0; color: #6b7280;">Tanggal:</td><td style="padding: 8px 0; font-weight: bold; text-align: right;">${check_in} - ${check_out}</td></tr>
        </table>
      </div>
      ${link ? `<p style="text-align:center;"><a href="${link}" style="display:inline-block;background:#f97316;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;">Lengkapi Profil / Kontak</a></p>` : ''}
    </div>
  `;

  try {
    await sendMail({ to: email, subject: `Terima kasih (#${id.substring(0, 8)})`, html }, c);
    return true;
  } catch (error) {
    console.error('Gagal kirim follow-up:', error);
    return false;
  }
};

export const sendPasswordResetEmail = async (email, resetUrl, config) => {
  const brandName = getBrandName(config);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a; text-align: center;">Reset Password</h2>
      <p>Anda meminta reset password untuk akun <strong>${brandName}</strong>.</p>
      <p>Jika ini bukan Anda, abaikan email ini.</p>
      <p style="text-align:center;">
        <a href="${resetUrl}" style="display:inline-block;background:#0f172a;color:white;padding:10px 14px;border-radius:8px;text-decoration:none;">Reset Password</a>
      </p>
      <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">Link ini akan kadaluarsa.</p>
    </div>
  `;

  try {
    await sendMail({ to: email, subject: 'Reset Password', html }, config);
    return true;
  } catch (error) {
    console.error('Gagal kirim reset password:', error);
    return false;
  }
};

export const sendTestEmail = async (email, config) => {
  const brandName = getBrandName(config);
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #0f172a; text-align: center;">Test Email</h2>
      <p>Email test dari <strong>${brandName}</strong> berhasil dikirim.</p>
    </div>
  `;
  try {
    await sendMail({ to: email, subject: 'Test Email', html }, config);
    return true;
  } catch (error) {
    console.error('Gagal kirim test email:', error);
    return false;
  }
};
