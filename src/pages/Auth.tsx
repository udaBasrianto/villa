import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getApiUrl } from "@/lib/utils";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const isReset = location.pathname === "/reset-password";
  const token = searchParams.get("token") || "";
  const API_URL = getApiUrl();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const data = await signIn(email, password);
        toast.success("Berhasil masuk!");
        
        if (data?.user?.role === 'admin') {
          navigate("/admin");
        } else {
          navigate("/");
        }
      } else {
        await signUp(email, password, fullName);
        toast.success("Akun berhasil dibuat!");
        navigate("/");
      }
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal mengirim link reset");
      toast.success(data?.message || "Jika email terdaftar, link reset akan dikirim.");
      setIsForgot(false);
      setIsLogin(true);
      setPassword("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      toast.error("Token reset tidak ditemukan");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password baru minimal 8 karakter");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("Konfirmasi password tidak cocok");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/password-reset/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Gagal reset password");
      toast.success("Password berhasil direset. Silakan login.");
      setNewPassword("");
      setConfirmNewPassword("");
      navigate("/auth");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <button
          onClick={() => (isReset ? navigate("/auth") : navigate("/"))}
          className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-lg font-bold text-foreground">
          {isReset ? "Reset Password" : isForgot ? "Lupa Password" : isLogin ? "Masuk" : "Daftar"}
        </h1>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 pb-10">
        <div className="max-w-sm mx-auto w-full">
          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-foreground">
              {isReset ? "Buat Password Baru" : isForgot ? "Kirim Link Reset" : isLogin ? "Selamat Datang!" : "Buat Akun Baru"}
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              {isReset
                ? "Masukkan password baru untuk akun Anda"
                : isForgot
                  ? "Masukkan email akun Anda. Kami akan kirim link reset password."
                  : isLogin
                ? "Masuk untuk melihat booking dan favorit Anda"
                : "Daftar untuk mulai booking villa impian"}
            </p>
          </div>

          {isReset ? (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-foreground text-sm font-medium">Password Baru</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="h-12 rounded-xl pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmNewPassword" className="text-foreground text-sm font-medium">Konfirmasi Password Baru</Label>
                <Input
                  id="confirmNewPassword"
                  type={showNewPassword ? "text" : "password"}
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="h-12 rounded-xl"
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-bold mt-2"
                disabled={loading || !token}
              >
                {loading ? "Memproses..." : "Reset Password"}
              </Button>

              {!token && (
                <div className="text-sm text-muted-foreground">
                  Token tidak ditemukan. Pastikan Anda membuka link dari email.
                </div>
              )}
            </form>
          ) : isForgot ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contoh@email.com"
                  required
                  className="h-12 rounded-xl"
                />
              </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl text-base font-bold mt-2"
              disabled={loading}
            >
              {loading ? "Memproses..." : "Kirim Link Reset"}
            </Button>

            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsForgot(false)}
                className="text-primary font-bold hover:underline text-sm"
              >
                Kembali ke Login
              </button>
            </div>
          </form>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                {!isLogin && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-foreground text-sm font-medium">Nama Lengkap</Label>
                    <Input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masukkan nama lengkap"
                      required={!isLogin}
                      className="h-12 rounded-xl"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="contoh@email.com"
                    required
                    className="h-12 rounded-xl"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" title="Password" className="text-foreground text-sm font-medium">Password</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="h-12 rounded-xl pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {isLogin && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setIsForgot(true)}
                      className="text-sm text-primary font-bold hover:underline"
                    >
                      Lupa password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full h-12 rounded-xl text-base font-bold mt-2"
                  disabled={loading}
                >
                  {loading ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
                </Button>
              </form>

              <div className="mt-8 text-center">
                <p className="text-sm text-muted-foreground">
                  {isLogin ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
                  <button
                    onClick={() => {
                      setIsLogin(!isLogin);
                      setIsForgot(false);
                    }}
                    className="text-primary font-bold hover:underline"
                  >
                    {isLogin ? "Daftar Sekarang" : "Masuk Sekarang"}
                  </button>
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;
