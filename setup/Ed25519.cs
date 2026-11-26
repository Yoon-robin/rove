// Ed25519 signature check (RFC 8032 5.1.7), for the setup window: .NET Framework 4.x has no
// Ed25519, and the window must trust latest.json only as far as the installed Rove does
// (update.cjs). Checking only — nothing here signs or holds a secret, so plain BigInteger
// arithmetic (slow, not constant-time) is enough: it runs once, on public values.
using System;
using System.Numerics;
using System.Security.Cryptography;
using System.Text;

static class Ed25519
{
    static readonly BigInteger P = BigInteger.Pow(2, 255) - 19;
    static readonly BigInteger L = BigInteger.Pow(2, 252) + BigInteger.Parse("27742317777372353535851937790883648493");
    static readonly BigInteger D = Mod(-121665 * Inv(121666));
    static readonly BigInteger SqrtM1 = BigInteger.ModPow(2, (P - 1) / 4, P);
    static readonly BigInteger[] G = BaseG();
    // what a release key is given as (config.cjs updateKeys): SPKI DER, this prefix and then the 32 key bytes
    static readonly byte[] Spki = { 0x30, 0x2a, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x03, 0x21, 0x00 };

    static BigInteger Mod(BigInteger a) { var r = a % P; return r.Sign < 0 ? r + P : r; }
    static BigInteger Inv(BigInteger a) { return BigInteger.ModPow(a, P - 2, P); }
    static BigInteger Le(byte[] b, int at, int n) { var x = new byte[n + 1]; Array.Copy(b, at, x, 0, n); return new BigInteger(x); }

    static BigInteger[] BaseG()
    {
        var y = Mod(4 * Inv(5));
        var x = RecoverX(y, 0).Value;
        return new[] { x, y, BigInteger.One, Mod(x * y) };
    }
    static BigInteger? RecoverX(BigInteger y, int sign)
    {
        if (y >= P) return null;
        var x2 = Mod((y * y - 1) * Inv(D * y * y + 1));
        if (x2.IsZero) return sign == 0 ? (BigInteger?)BigInteger.Zero : null;
        var x = BigInteger.ModPow(x2, (P + 3) / 8, P);
        if (!Mod(x * x - x2).IsZero) x = Mod(x * SqrtM1);
        if (!Mod(x * x - x2).IsZero) return null;
        if ((int)(x & 1) != sign) x = P - x;
        return x;
    }
    static BigInteger[] Decompress(byte[] b, int at)
    {
        var y = Le(b, at, 32);
        int sign = (int)(y >> 255);
        y &= (BigInteger.One << 255) - 1;
        var x = RecoverX(y, sign);
        return x == null ? null : new[] { x.Value, y, BigInteger.One, Mod(x.Value * y) };
    }
    static BigInteger[] Add(BigInteger[] p, BigInteger[] q)
    {
        var a = Mod((p[1] - p[0]) * (q[1] - q[0])); var b = Mod((p[1] + p[0]) * (q[1] + q[0]));
        var c = Mod(p[3] * 2 * D * q[3]); var d = Mod(p[2] * 2 * q[2]);
        BigInteger e = b - a, f = d - c, g = d + c, h = b + a;
        return new[] { Mod(e * f), Mod(g * h), Mod(f * g), Mod(e * h) };
    }
    static BigInteger[] Mul(BigInteger s, BigInteger[] p)
    {
        var q = new[] { BigInteger.Zero, BigInteger.One, BigInteger.One, BigInteger.Zero };
        for (; s.Sign > 0; s >>= 1) { if (!s.IsEven) q = Add(q, p); p = Add(p, p); }
        return q;
    }
    static bool Same(BigInteger[] p, BigInteger[] q)
    {
        return Mod(p[0] * q[2] - q[0] * p[2]).IsZero && Mod(p[1] * q[2] - q[1] * p[2]).IsZero;
    }

    // key: 32 bytes; sig: 64 bytes
    public static bool Verify(byte[] key, byte[] message, byte[] sig)
    {
        if (key == null || key.Length != 32 || sig == null || sig.Length != 64) return false;
        var a = Decompress(key, 0); var r = Decompress(sig, 0);
        if (a == null || r == null) return false;
        var s = Le(sig, 32, 32);
        if (s >= L) return false;
        byte[] hash;
        using (var sha = SHA512.Create())
        {
            var all = new byte[64 + message.Length];
            Array.Copy(sig, 0, all, 0, 32); Array.Copy(key, 0, all, 32, 32); Array.Copy(message, 0, all, 64, message.Length);
            hash = sha.ComputeHash(all);
        }
        var h = Le(hash, 0, 64) % L;
        return Same(Mul(s, G), Add(r, Mul(h, a)));
    }

    // any one of the release keys (base64 SPKI) signed text (UTF-8), the signature given as base64
    public static bool SignedByAny(string[] keys, string text, string sig64)
    {
        byte[] sig;
        try { sig = Convert.FromBase64String(sig64 ?? ""); } catch (FormatException) { return false; }
        var message = Encoding.UTF8.GetBytes(text);
        foreach (var k in keys)
        {
            byte[] der;
            try { der = Convert.FromBase64String(k); } catch (FormatException) { continue; }
            if (der.Length != Spki.Length + 32) continue;
            bool prefix = true;
            for (int i = 0; i < Spki.Length; i++) if (der[i] != Spki[i]) prefix = false;
            if (!prefix) continue;
            var key = new byte[32]; Array.Copy(der, Spki.Length, key, 0, 32);
            if (Verify(key, message, sig)) return true;
        }
        return false;
    }
}
