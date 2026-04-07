import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import QRCode from 'qrcode';

dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendBookingReceipt = async (email, bookingDetails) => {
  const { room_name, check_in, check_out, guests, children, total_price, child_discount, payment_method, id } = bookingDetails;
  
  const formatPrice = (price) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(price);

  try {
    // Generate QR Code
    const qrCodeDataUrl = await QRCode.toDataURL(id);
    
    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `Struk Booking - ${room_name} (#${id.substring(0, 8)})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #f97316; text-align: center;">Konfirmasi Booking</h2>
          <p>Halo,</p>
          <p>Terima kasih telah melakukan booking di <strong>Villa Sunset Paradise</strong>. Berikut adalah detail pesanan Anda:</p>
          
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
          <div style="background: white; padding: 10px; border-radius: 5px; font-family: monospace;">
            Bank BCA: 1234567890<br>
            A/N: Villa Sunset Paradise
          </div>
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

    await transporter.sendMail(mailOptions);
    console.log(`Email struk terkirim ke: ${email}`);
    return true;
  } catch (error) {
    console.error('Gagal memproses email atau QR Code:', error);
    return false;
  }
};