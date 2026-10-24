# ============================================
# IMPORT LIBRARY YANG DIBUTUHKAN
# ============================================
import xml.etree.ElementTree as ET
import json
from datetime import datetime
from xml.dom import minidom


# ============================================
# SIAKAD (Data Mahasiswa)
# ============================================
class SIAKADService:
    """SOAP Service untuk data mahasiswa"""

    def __init__(self):
        # Simulasi database mahasiswa
        self.database = {
            "2021001": {"nama": "Budi Santoso", "jurusan": "Informatika", "angkatan": 2021},
            "2021002": {"nama": "Siti Aminah", "jurusan": "Sistem Informasi", "angkatan": 2021},
            "2022001": {"nama": "Andi Wijaya", "jurusan": "Informatika", "angkatan": 2022},
        }

    def get_mahasiswa(self, nim):
        """Operasi: getMahasiswa"""
        if nim in self.database:
            return {"status": "success", "data": self.database[nim]}
        return {"status": "error", "message": f"Mahasiswa {nim} tidak ditemukan"}

    def build_soap_response(self, nim):
        """Membangun SOAP Response XML"""
        result = self.get_mahasiswa(nim)

        if result["status"] == "success":
            data = result["data"]
            soap_response = f'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:siakad="http://kampus.ac.id/siakad">
    <soap:Body>
        <siakad:GetMahasiswaResponse>
            <siakad:NIM>{nim}</siakad:NIM>
            <siakad:Nama>{data["nama"]}</siakad:Nama>
            <siakad:Jurusan>{data["jurusan"]}</siakad:Jurusan>
            <siakad:Angkatan>{data["angkatan"]}</siakad:Angkatan>
        </siakad:GetMahasiswaResponse>
    </soap:Body>
</soap:Envelope>'''
        else:
            soap_response = f'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
    <soap:Body>
        <soap:Fault>
            <soap:Code>Client</soap:Code>
            <soap:Reason>{result["message"]}</soap:Reason>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>'''
        return soap_response


# Inisialisasi service
siakad = SIAKADService()
print(" SIAKAD Service siap dijalankan")
print(f" Total mahasiswa di database: {len(siakad.database)}")


# ============================================
# SINILAI (Data Nilai)
# ============================================
class SINILAIService:
    """SOAP Service untuk nilai akademik"""

    def __init__(self):
        # Simulasi database nilai
        self.database = {
            "2021001": {
                1: [
                    {"mk": "Pemrograman Dasar", "sks": 3, "nilai": "A"},
                    {"mk": "Matematika Diskrit", "sks": 3, "nilai": "B+"},
                    {"mk": "Basis Data", "sks": 3, "nilai": "A"},
                ]
            },
            "2021002": {
                1: [
                    {"mk": "Pengantar SI", "sks": 3, "nilai": "A"},
                    {"mk": "Algoritma", "sks": 4, "nilai": "B"},
                ]
            },
        }

    def get_nilai(self, nim, semester):
        """Operasi: getNilai"""
        if nim in self.database and semester in self.database[nim]:
            return {"status": "success", "data": self.database[nim][semester]}
        return {"status": "error", "message": f"Nilai {nim} semester {semester} tidak ditemukan"}

    def build_soap_response(self, nim, semester):
        """Membangun SOAP Response XML"""
        result = self.get_nilai(nim, semester)

        if result["status"] == "success":
            nilai_xml = ""
            for n in result["data"]:
                nilai_xml += f'''
            <sinilai:NilaiItem>
                <sinilai:MataKuliah>{n["mk"]}</sinilai:MataKuliah>
                <sinilai:SKS>{n["sks"]}</sinilai:SKS>
                <sinilai:Nilai>{n["nilai"]}</sinilai:Nilai>
            </sinilai:NilaiItem>'''

            soap_response = f'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:sinilai="http://kampus.ac.id/sinilai">
    <soap:Body>
        <sinilai:GetNilaiResponse>
            <sinilai:NIM>{nim}</sinilai:NIM>
            <sinilai:Semester>{semester}</sinilai:Semester>{nilai_xml}
        </sinilai:GetNilaiResponse>
    </soap:Body>
</soap:Envelope>'''
        else:
            soap_response = f'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
    <soap:Body>
        <soap:Fault>
            <soap:Code>Client</soap:Code>
            <soap:Reason>{result["message"]}</soap:Reason>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>'''
        return soap_response


# Inisialisasi service
sinilai = SINILAIService()
print("SINILAI Service siap dijalankan")
print(f"📋 Total record nilai: {len(sinilai.database)}")


# ============================================
#  SIKEU (Pembayaran UKT)
# ============================================
class SIKEUService:
    """SOAP Service untuk status pembayaran"""

    def __init__(self):
        # Simulasi database pembayaran
        self.database = {
            "2021001": {"status": "LUNAS", "nominal": 5000000, "tgl_bayar": "2024-08-15"},
            "2021002": {"status": "LUNAS", "nominal": 4500000, "tgl_bayar": "2024-08-20"},
            "2022001": {"status": "BELUM LUNAS", "nominal": 5000000, "tgl_bayar": None},
        }

    def get_status_bayar(self, nim):
        """Operasi: getStatusBayar"""
        if nim in self.database:
            return {"status": "success", "data": self.database[nim]}
        return {"status": "error", "message": f"Data pembayaran {nim} tidak ditemukan"}

    def build_soap_response(self, nim):
        """Membangun SOAP Response XML"""
        result = self.get_status_bayar(nim)

        if result["status"] == "success":
            data = result["data"]
            tgl = data["tgl_bayar"] if data["tgl_bayar"] else "-"
            soap_response = f'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope"
               xmlns:sikeu="http://kampus.ac.id/sikeu">
    <soap:Body>
        <sikeu:GetStatusBayarResponse>
            <sikeu:NIM>{nim}</sikeu:NIM>
            <sikeu:Status>{data["status"]}</sikeu:Status>
            <sikeu:Nominal>{data["nominal"]}</sikeu:Nominal>
            <sikeu:TglBayar>{tgl}</sikeu:TglBayar>
        </sikeu:GetStatusBayarResponse>
    </soap:Body>
</soap:Envelope>'''
        else:
            soap_response = f'''<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope">
    <soap:Body>
        <soap:Fault>
            <soap:Code>Client</soap:Code>
            <soap:Reason>{result["message"]}</soap:Reason>
        </soap:Fault>
    </soap:Body>
</soap:Envelope>'''
        return soap_response


# Inisialisasi service
sikeu = SIKEUService()
print(" SIKEU Service siap dijalankan")
print(f" Total record pembayaran: {len(sikeu.database)}")


# ============================================
#  Portal Mahasiswa (Consumer)
# ============================================
class PortalMahasiswa:
    """SOAP Client yang meng-invoke ketiga service"""

    def __init__(self, siakad_svc, sinilai_svc, sikeu_svc):
        self.siakad = siakad_svc
        self.sinilai = sinilai_svc
        self.sikeu = sikeu_svc
        self.invocation_log = []

    def _log(self, service, operation, status):
        """Log setiap invocation (audit trail)"""
        self.invocation_log.append({
            "timestamp": datetime.now().strftime('%H:%M:%S'),
            "service": service,
            "operation": operation,
            "status": status
        })

    def get_khs(self, nim, semester):
        """
        Operasi utama: gabungkan data dari 3 service
        Menerapkan prinsip Service Invocation
        """
        print(f"\n{'='*60}")
        print(f"📄 MEMPROSES KHS - NIM: {nim}, Semester: {semester}")
        print(f"{'='*60}")

        # === STEP 1: Invoke SIAKAD Service ===
        print("\n[1/3] 🔍 Invoking SIAKAD Service: getMahasiswa...")
        soap_siakad = self.siakad.build_soap_response(nim)
        data_mhs = self._parse_siakad(soap_siakad)

        if data_mhs is None:
            self._log("SIAKAD", "getMahasiswa", "FAILED")
            return {"error": "Mahasiswa tidak ditemukan"}

        self._log("SIAKAD", "getMahasiswa", "SUCCESS")
        print(f"      Berhasil: {data_mhs['nama']}")

        # === STEP 2: Invoke SINILAI Service ===
        print("\n[2/3]  Invoking SINILAI Service: getNilai...")
        soap_sinilai = self.sinilai.build_soap_response(nim, semester)
        data_nilai = self._parse_sinilai(soap_sinilai)

        if data_nilai is None:
            self._log("SINILAI", "getNilai", "FAILED")
            return {"error": "Data nilai tidak ditemukan"}

        self._log("SINILAI", "getNilai", "SUCCESS")
        print(f"      Berhasil: {len(data_nilai)} mata kuliah")

        # === STEP 3: Invoke SIKEU Service ===
        print("\n[3/3]  Invoking SIKEU Service: getStatusBayar...")
        soap_sikeu = self.sikeu.build_soap_response(nim)
        data_bayar = self._parse_sikeu(soap_sikeu)

        if data_bayar is None:
            self._log("SIKEU", "getStatusBayar", "FAILED")
            return {"error": "Data pembayaran tidak ditemukan"}

        self._log("SIKEU", "getStatusBayar", "SUCCESS")
        print(f"      Berhasil: {data_bayar['status']}")

        # === GABUNGKAN DATA ===
        return {
            "mahasiswa": data_mhs,
            "nilai": data_nilai,
            "pembayaran": data_bayar
        }

    def _parse_siakad(self, xml_string):
        """Parse SOAP response SIAKAD"""
        try:
            root = ET.fromstring(xml_string)
            ns = {'soap': 'http://www.w3.org/2003/05/soap-envelope',
                  'siakad': 'http://kampus.ac.id/siakad'}

            # Cek Fault
            fault = root.find('.//soap:Fault', ns)
            if fault is not None:
                return None

            return {
                "nim": root.find('.//siakad:NIM', ns).text,
                "nama": root.find('.//siakad:Nama', ns).text,
                "jurusan": root.find('.//siakad:Jurusan', ns).text,
                "angkatan": int(root.find('.//siakad:Angkatan', ns).text)
            }
        except Exception as e:
            print(f"      Parse error: {e}")
            return None

    def _parse_sinilai(self, xml_string):
        """Parse SOAP response SINILAI"""
        try:
            root = ET.fromstring(xml_string)
            ns = {'soap': 'http://www.w3.org/2003/05/soap-envelope',
                  'sinilai': 'http://kampus.ac.id/sinilai'}

            fault = root.find('.//soap:Fault', ns)
            if fault is not None:
                return None

            items = []
            for item in root.findall('.//sinilai:NilaiItem', ns):
                items.append({
                    "mk": item.find('sinilai:MataKuliah', ns).text,
                    "sks": int(item.find('sinilai:SKS', ns).text),
                    "nilai": item.find('sinilai:Nilai', ns).text
                })
            return items
        except Exception as e:
            print(f"      Parse error: {e}")
            return None

    def _parse_sikeu(self, xml_string):
        """Parse SOAP response SIKEU"""
        try:
            root = ET.fromstring(xml_string)
            ns = {'soap': 'http://www.w3.org/2003/05/soap-envelope',
                  'sikeu': 'http://kampus.ac.id/sikeu'}

            fault = root.find('.//soap:Fault', ns)
            if fault is not None:
                return None

            return {
                "status": root.find('.//sikeu:Status', ns).text,
                "nominal": int(root.find('.//sikeu:Nominal', ns).text),
                "tgl_bayar": root.find('.//sikeu:TglBayar', ns).text
            }
        except Exception as e:
            print(f"      Parse error: {e}")
            return None


# Inisialisasi portal
portal = PortalMahasiswa(siakad, sinilai, sikeu)
print(" Portal Mahasiswa (SOAP Client) siap")


# ============================================
# SKENARIO 1: Mahasiswa dengan data lengkap
# ============================================
hasil = portal.get_khs("2021001", semester=1)

if "error" not in hasil:
    mhs = hasil["mahasiswa"]
    nilai = hasil["nilai"]
    bayar = hasil["pembayaran"]

    print(f"\n{'='*60}")
    print("📋 KARTU HASIL STUDI (KHS)")
    print(f"{'='*60}")
    print(f"NIM       : {mhs['nim']}")
    print(f"Nama      : {mhs['nama']}")
    print(f"Jurusan   : {mhs['jurusan']}")
    print(f"Angkatan  : {mhs['angkatan']}")
    print(f"\n{'-'*60}")
    print(f"{'Mata Kuliah':<30} {'SKS':>5} {'Nilai':>8}")
    print(f"{'-'*60}")

    total_sks = 0
    bobot_nilai = {"A": 4.0, "A-": 3.7, "B+": 3.3, "B": 3.0, "C+": 2.3, "C": 2.0}
    total_mutu = 0

    for n in nilai:
        print(f"{n['mk']:<30} {n['sks']:>5} {n['nilai']:>8}")
        total_sks += n['sks']
        total_mutu += bobot_nilai.get(n['nilai'], 0) * n['sks']

    ipk = total_mutu / total_sks if total_sks > 0 else 0

    print(f"{'-'*60}")
    print(f"{'Total SKS':<30} {total_sks:>5}")
    print(f"{'IPK':<30} {ipk:>8.2f}")
    print(f"{'-'*60}")
    print(f"\n Status Pembayaran : {bayar['status']}")
    print(f" Nominal           : Rp {bayar['nominal']:,}")
    print(f" Tanggal Bayar     : {bayar['tgl_bayar']}")
    print(f"{'='*60}")


# ============================================
# SKENARIO 2: Mahasiswa TIDAK DITEMUKAN (Fault)
# ============================================
print("\n" + "🔴 " * 20)
print("SKENARIO ERROR: NIM tidak valid")
print("🔴 " * 20)

hasil_error = portal.get_khs("9999999", semester=1)
print(f"\n Hasil: {hasil_error}")


# ============================================
# SKENARIO 3: Mahasiswa ada tapi BELUM BAYAR
# ============================================
print("\n" + "🟡 " * 20)
print("SKENARIO: Mahasiswa BELUM BAYAR UKT")
print("🟡 " * 20)

# Catatan: 2022001 belum punya data nilai, hanya demo pengecekan
print("\n🔍 Cek status bayar NIM 2022001:")
soap_bayar = sikeu.build_soap_response("2022001")
print(soap_bayar)


# ============================================
# AUDIT TRAIL: Log semua invocation
# ============================================
import pandas as pd

print("📊 AUDIT TRAIL - Semua Service Invocation")
print("=" * 60)

df_log = pd.DataFrame(portal.invocation_log)
print(df_log.to_string(index=False))

print(f"\n Total Invocation: {len(portal.invocation_log)}")
print(f" Sukses: {sum(1 for l in portal.invocation_log if l['status']=='SUCCESS')}")
print(f" Gagal : {sum(1 for l in portal.invocation_log if l['status']=='FAILED')}")
