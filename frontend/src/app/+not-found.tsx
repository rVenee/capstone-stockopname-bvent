import { Redirect } from "expo-router";

// Alamat yang tidak dikenal (mis. alamat kosong yang dikirim Android setelah lembar bagikan ditutup)
// diarahkan ke awal aplikasi, sehingga layar "Unmatched Route" tidak pernah muncul.
export default function TidakDitemukan() {
  return <Redirect href="/" />;
}