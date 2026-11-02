import com.android.apksig.ApkSigner;
import com.android.apksig.ApkVerifier;

import java.io.File;
import java.io.FileInputStream;
import java.security.KeyStore;
import java.security.PrivateKey;
import java.security.cert.X509Certificate;
import java.util.Collections;

/**
 * Assina o APK (esquema v2, usado do Android 7 em diante) e confere a assinatura.
 * Uso: java SignApk <chave.p12> <senha> <apelido> <entrada.apk> <saida.apk>
 */
public class SignApk {
    public static void main(String[] args) throws Exception {
        String keystore = args[0];
        char[] pass = args[1].toCharArray();
        String alias = args[2];
        File in = new File(args[3]);
        File out = new File(args[4]);

        KeyStore ks = KeyStore.getInstance("PKCS12");
        try (FileInputStream fis = new FileInputStream(keystore)) {
            ks.load(fis, pass);
        }
        PrivateKey key = (PrivateKey) ks.getKey(alias, pass);
        X509Certificate cert = (X509Certificate) ks.getCertificate(alias);

        ApkSigner.SignerConfig signer = new ApkSigner.SignerConfig.Builder(
                "ilha", key, Collections.singletonList(cert)).build();
        new ApkSigner.Builder(Collections.singletonList(signer))
                .setInputApk(in)
                .setOutputApk(out)
                .setMinSdkVersion(24)
                .setV1SigningEnabled(false) // v1 só é necessário antes do Android 7
                .setV2SigningEnabled(true)
                .build()
                .sign();

        ApkVerifier.Result result = new ApkVerifier.Builder(out).build().verify();
        if (!result.isVerified()) {
            for (Object e : result.getErrors()) System.err.println("ERRO: " + e);
            throw new IllegalStateException("Assinatura inválida");
        }
        System.out.println("Assinatura OK (v1=" + result.isVerifiedUsingV1Scheme()
                + ", v2=" + result.isVerifiedUsingV2Scheme() + ")");
    }
}
