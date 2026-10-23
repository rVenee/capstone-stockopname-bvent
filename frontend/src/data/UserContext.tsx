import { createContext, ReactNode, useContext, useState } from "react";

export type User = {
  nama: string;
  email: string;
  telepon: string;
  peran: string;
  perusahaan: string;
};

const awal: User = {
  nama: "Rahmat Firman Syaputra",
  email: "rahmat@jayaabadi.com",
  telepon: "+6281234567890",
  peran: "Admin",
  perusahaan: "PT Jaya Abadi - JYA112",
};

type Ctx = { user: User; ubahUser: (patch: Partial<User>) => void };

const UserContext = createContext<Ctx | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User>(awal);
  return (
    <UserContext.Provider value={{ user, ubahUser: (p) => setUser((u) => ({ ...u, ...p })) }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser harus dipakai di dalam UserProvider");
  return ctx;
}

export const namaDepan = (nama: string) => nama.trim().split(/\s+/)[0] ?? "";