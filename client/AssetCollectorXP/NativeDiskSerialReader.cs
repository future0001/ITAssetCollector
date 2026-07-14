using Microsoft.Win32.SafeHandles;
using System;
using System.Runtime.InteropServices;
using System.Text;

namespace AssetCollector
{
    public static class NativeDiskSerialReader
    {
        private const uint GENERIC_READ = 0x80000000;
        private const uint FILE_SHARE_READ = 0x00000001;
        private const uint FILE_SHARE_WRITE = 0x00000002;
        private const uint OPEN_EXISTING = 3;
        private const uint IOCTL_STORAGE_QUERY_PROPERTY = 0x002D1400;
        private const uint IOCTL_ATA_PASS_THROUGH = 0x0004D02C;
        private const uint GENERIC_WRITE = 0x40000000;
        private const ushort ATA_FLAGS_DRDY_REQUIRED = 0x0001;
        private const ushort ATA_FLAGS_DATA_IN = 0x0002;
        private const byte ATA_IDENTIFY_DEVICE = 0xEC;
        private static readonly int AtaPassThroughExSize = IntPtr.Size == 4 ? 40 : 48;
        private const int AtaIdentifyDataSize = 512;
        private const int StorageAdapterProtocolSpecificProperty = 49;
        private const int StorageDeviceProtocolSpecificProperty = 50;
        private const int PropertyStandardQuery = 0;
        private const int ProtocolTypeNvme = 3;
        private const int NVMeDataTypeIdentify = 1;
        private const int NVME_IDENTIFY_CNS_CONTROLLER = 1;
        private const int StorageProtocolSpecificDataSize = 40;
        private const int StorageProtocolDataDescriptorHeaderSize = 8;
        private const int NvmeIdentifyControllerDataSize = 4096;

        public static string ReadStorageDeviceSerial(int physicalDriveIndex)
        {
            try
            {
                if (physicalDriveIndex < 0) return string.Empty;

                string serial = ReadStorageDeviceSerial(physicalDriveIndex, 0);
                if (!string.IsNullOrWhiteSpace(serial)) return serial;

                serial = ReadStorageDeviceSerial(physicalDriveIndex, GENERIC_READ);
                if (!string.IsNullOrWhiteSpace(serial)) return serial;

                return ReadStorageDeviceSerial(physicalDriveIndex, GENERIC_READ | GENERIC_WRITE);
            }
            catch
            {
                return string.Empty;
            }
        }

        private static string ReadStorageDeviceSerial(int physicalDriveIndex, uint access)
        {
            string path = @"\\.\PhysicalDrive" + physicalDriveIndex;
            using (SafeFileHandle handle = CreateFile(path, access, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero))
            {
                if (handle == null || handle.IsInvalid) return string.Empty;

                byte[] query = new byte[12];
                byte[] output = new byte[16384];
                uint returned;

                bool ok = DeviceIoControl(
                    handle,
                    IOCTL_STORAGE_QUERY_PROPERTY,
                    query,
                    (uint)query.Length,
                    output,
                    (uint)output.Length,
                    out returned,
                    IntPtr.Zero);

                if (!ok || returned < 40) return string.Empty;

                int serialOffset = BitConverter.ToInt32(output, 24);
                if (serialOffset <= 0 || serialOffset >= output.Length) return string.Empty;

                int end = serialOffset;
                while (end < output.Length && output[end] != 0) end++;
                if (end <= serialOffset) return string.Empty;

                return Encoding.ASCII.GetString(output, serialOffset, end - serialOffset).Trim();
            }
        }

        public static string ReadAtaIdentifyDeviceSerial(int physicalDriveIndex)
        {
            try
            {
                byte[] identify = ReadAtaIdentifyDevice(physicalDriveIndex);
                return identify == null ? string.Empty : ReadAtaIdentifyString(identify, 20, 20);
            }
            catch
            {
                return string.Empty;
            }
        }

        public static string ReadNvmeIdentifyControllerSerial(int physicalDriveIndex)
        {
            try
            {
                string serial = ReadNvmeIdentifyControllerSerial(physicalDriveIndex, StorageAdapterProtocolSpecificProperty);
                if (!string.IsNullOrWhiteSpace(serial)) return serial;

                return ReadNvmeIdentifyControllerSerial(physicalDriveIndex, StorageDeviceProtocolSpecificProperty);
            }
            catch
            {
                return string.Empty;
            }
        }

        private static string ReadNvmeIdentifyControllerSerial(int physicalDriveIndex, int propertyId)
        {
            if (physicalDriveIndex < 0) return string.Empty;

            string serial = ReadNvmeIdentifyControllerSerial(physicalDriveIndex, propertyId, 0);
            if (!string.IsNullOrWhiteSpace(serial)) return serial;

            serial = ReadNvmeIdentifyControllerSerial(physicalDriveIndex, propertyId, GENERIC_READ);
            if (!string.IsNullOrWhiteSpace(serial)) return serial;

            return ReadNvmeIdentifyControllerSerial(physicalDriveIndex, propertyId, GENERIC_READ | GENERIC_WRITE);
        }

        private static string ReadNvmeIdentifyControllerSerial(int physicalDriveIndex, int propertyId, uint access)
        {
            string path = @"\\.\PhysicalDrive" + physicalDriveIndex;
            using (SafeFileHandle handle = CreateFile(path, access, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero))
            {
                if (handle == null || handle.IsInvalid) return string.Empty;

                int protocolDataOffset = StorageProtocolSpecificDataSize;
                int bufferLength = StorageProtocolDataDescriptorHeaderSize + StorageProtocolSpecificDataSize + NvmeIdentifyControllerDataSize;
                byte[] query = new byte[8 + StorageProtocolSpecificDataSize + NvmeIdentifyControllerDataSize];
                byte[] output = new byte[bufferLength];

                WriteInt32(query, 0, propertyId);
                WriteInt32(query, 4, PropertyStandardQuery);
                WriteInt32(query, 8, ProtocolTypeNvme);
                WriteInt32(query, 12, NVMeDataTypeIdentify);
                WriteInt32(query, 16, NVME_IDENTIFY_CNS_CONTROLLER);
                WriteInt32(query, 24, protocolDataOffset);
                WriteInt32(query, 28, NvmeIdentifyControllerDataSize);

                uint returned;
                bool ok = DeviceIoControl(
                    handle,
                    IOCTL_STORAGE_QUERY_PROPERTY,
                    query,
                    (uint)query.Length,
                    output,
                    (uint)output.Length,
                    out returned,
                    IntPtr.Zero);

                if (!ok || returned < StorageProtocolDataDescriptorHeaderSize + StorageProtocolSpecificDataSize + 24) return string.Empty;

                int returnedDataOffset = BitConverter.ToInt32(output, StorageProtocolDataDescriptorHeaderSize + 16);
                int returnedDataLength = BitConverter.ToInt32(output, StorageProtocolDataDescriptorHeaderSize + 20);
                if (returnedDataOffset <= 0) returnedDataOffset = protocolDataOffset;
                if (returnedDataLength <= 0) returnedDataLength = NvmeIdentifyControllerDataSize;

                int identifyOffset = StorageProtocolDataDescriptorHeaderSize + returnedDataOffset;
                string serial = ReadNvmeIdentifySerialAt(output, identifyOffset, returnedDataLength);
                if (!string.IsNullOrWhiteSpace(serial)) return serial;

                serial = ReadNvmeIdentifySerialAt(output, returnedDataOffset, returnedDataLength);
                if (!string.IsNullOrWhiteSpace(serial)) return serial;

                return ReadNvmeIdentifySerialAt(output, StorageProtocolDataDescriptorHeaderSize + protocolDataOffset, NvmeIdentifyControllerDataSize);
            }
        }

        private static string ReadNvmeIdentifySerialAt(byte[] output, int identifyOffset, int identifyLength)
        {
            if (output == null || identifyOffset < 0 || identifyOffset + 24 > output.Length || identifyLength < 24) return string.Empty;

            string serial = CleanAscii(Encoding.ASCII.GetString(output, identifyOffset + 4, 20));
            string model = identifyOffset + 64 <= output.Length
                ? CleanAscii(Encoding.ASCII.GetString(output, identifyOffset + 24, 40))
                : string.Empty;

            if (string.IsNullOrWhiteSpace(serial)) return string.Empty;
            if (!string.IsNullOrWhiteSpace(model) || LooksLikeVendorSerial(serial)) return serial;
            return string.Empty;
        }

        private static byte[] ReadAtaIdentifyDevice(int physicalDriveIndex)
        {
            if (physicalDriveIndex < 0) return null;

            byte[] identify = ReadAtaIdentifyDevice(physicalDriveIndex, 0);
            if (identify != null) return identify;

            identify = ReadAtaIdentifyDevice(physicalDriveIndex, GENERIC_READ);
            if (identify != null) return identify;

            return ReadAtaIdentifyDevice(physicalDriveIndex, GENERIC_READ | GENERIC_WRITE);
        }

        private static byte[] ReadAtaIdentifyDevice(int physicalDriveIndex, uint access)
        {
            string path = @"\\.\PhysicalDrive" + physicalDriveIndex;
            using (SafeFileHandle handle = CreateFile(path, access, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero))
            {
                if (handle == null || handle.IsInvalid) return null;

                byte[] buffer = new byte[AtaPassThroughExSize + AtaIdentifyDataSize];
                WriteInt16(buffer, 0, AtaPassThroughExSize);
                WriteInt16(buffer, 2, ATA_FLAGS_DATA_IN | ATA_FLAGS_DRDY_REQUIRED);
                WriteInt32(buffer, 8, AtaIdentifyDataSize);
                WriteInt32(buffer, 12, 5);
                WriteIntPtrValue(buffer, 24, AtaPassThroughExSize);

                int taskFile = 40;
                buffer[taskFile + 1] = 1;
                buffer[taskFile + 5] = 0xA0;
                buffer[taskFile + 6] = ATA_IDENTIFY_DEVICE;

                uint returned;
                bool ok = DeviceIoControl(
                    handle,
                    IOCTL_ATA_PASS_THROUGH,
                    buffer,
                    (uint)buffer.Length,
                    buffer,
                    (uint)buffer.Length,
                    out returned,
                    IntPtr.Zero);

                if (!ok || returned < AtaPassThroughExSize + 64) return null;

                byte[] identify = new byte[AtaIdentifyDataSize];
                Buffer.BlockCopy(buffer, AtaPassThroughExSize, identify, 0, identify.Length);
                return identify;
            }
        }

        private static string ReadAtaIdentifyString(byte[] data, int offset, int length)
        {
            if (data == null || data.Length < offset + length) return string.Empty;

            var chars = new char[length];
            for (int i = 0; i < length; i += 2)
            {
                chars[i] = (char)data[offset + i + 1];
                chars[i + 1] = (char)data[offset + i];
            }
            return CleanAscii(new string(chars));
        }

        private static void WriteInt16(byte[] buffer, int offset, int value)
        {
            byte[] bytes = BitConverter.GetBytes((short)value);
            Buffer.BlockCopy(bytes, 0, buffer, offset, bytes.Length);
        }

        private static void WriteInt32(byte[] buffer, int offset, int value)
        {
            byte[] bytes = BitConverter.GetBytes(value);
            Buffer.BlockCopy(bytes, 0, buffer, offset, bytes.Length);
        }

        private static void WriteIntPtrValue(byte[] buffer, int offset, long value)
        {
            byte[] bytes = IntPtr.Size == 4 ? BitConverter.GetBytes((int)value) : BitConverter.GetBytes(value);
            Buffer.BlockCopy(bytes, 0, buffer, offset, bytes.Length);
        }

        private static string CleanAscii(string value)
        {
            if (string.IsNullOrEmpty(value)) return string.Empty;

            var sb = new StringBuilder();
            foreach (char c in value)
            {
                if (c >= 32 && c <= 126) sb.Append(c);
            }
            return sb.ToString().Trim();
        }

        private static bool LooksLikeVendorSerial(string value)
        {
            if (string.IsNullOrWhiteSpace(value)) return false;

            int alphaNumericCount = 0;
            foreach (char c in value)
            {
                if (char.IsLetterOrDigit(c)) alphaNumericCount++;
            }

            return alphaNumericCount >= 5;
        }

        [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
        private static extern SafeFileHandle CreateFile(
            string lpFileName,
            uint dwDesiredAccess,
            uint dwShareMode,
            IntPtr lpSecurityAttributes,
            uint dwCreationDisposition,
            uint dwFlagsAndAttributes,
            IntPtr hTemplateFile);

        [DllImport("kernel32.dll", SetLastError = true)]
        private static extern bool DeviceIoControl(
            SafeFileHandle hDevice,
            uint dwIoControlCode,
            byte[] lpInBuffer,
            uint nInBufferSize,
            byte[] lpOutBuffer,
            uint nOutBufferSize,
            out uint lpBytesReturned,
            IntPtr lpOverlapped);
    }
}
