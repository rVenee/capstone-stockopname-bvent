from app.mesin_impor import ke_angka, ke_tanggal, sarankan

print(ke_angka("$4.50 "), ke_angka("Rp 1.250"), ke_tanggal("8/16/2024", "bulan-hari"))
print(sarankan(["Product_ID", "Product_Name", "Unit_Price"], "barang"))