// passenger-portal/src/components/BoardingPass.tsx
import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  Divider,
  Chip,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import PrintIcon from "@mui/icons-material/Print";
import DownloadIcon from "@mui/icons-material/Download";
import TrainIcon from "@mui/icons-material/Train";
import "../styles/components/BoardingPass.css";

interface PassengerData {
  PNR_Number?: string;
  Name?: string;
  Train_Number?: string;
  Train_Name?: string;
  Journey_Date?: string;
  PNR_Status?: string;
  Assigned_Coach?: string;
  Assigned_berth?: string;
  Berth_Type?: string;
  Class?: string;
  Boarding_Station?: string;
  Deboarding_Station?: string;
  Upgraded_From?: string;
  Age?: number;
  Gender?: string;
}

interface BoardingPassProps {
  passenger?: PassengerData;
  journeyStarted?: boolean;
  currentStation?: string;
}

function BoardingPass({
  passenger,
  journeyStarted,
  currentStation,
}: BoardingPassProps): React.ReactElement {
  const [showQR] = useState<boolean>(true);

  // Read logged-in user's profile details from localStorage (set at login)
  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  // Simple plain-text QR — ASCII only, minimal lines for easy phone scanning
  const qrData = [
    `E-BOARDING PASS`,
    `PNR: ${passenger?.PNR_Number || 'N/A'}`,
    `Name: ${passenger?.Name || 'N/A'}`,
    `Status: ${passenger?.PNR_Status || 'N/A'}`,
    `Train: ${passenger?.Train_Number || 'N/A'}`,
    `Date: ${passenger?.Journey_Date || 'N/A'}`,
    `Coach: ${passenger?.Assigned_Coach || 'N/A'}`,
    `Berth: ${passenger?.Assigned_berth || 'N/A'}`,
    `${passenger?.Boarding_Station || ''} to ${passenger?.Deboarding_Station || ''}`,
  ].join('\n');

  const handlePrint = (): void => {
    window.print();
  };

  const handleDownload = (): void => {
    const svg = document.getElementById("qr-code-svg");
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL("image/png");

      const downloadLink = document.createElement("a");
      downloadLink.download = `boarding-pass-${passenger?.PNR_Number}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(svgData);
  };

  const getStatusColor = (
    status?: string,
  ): "success" | "warning" | "error" | "default" => {
    switch (status) {
      case "CNF":
        return "success";
      case "RAC":
        return "warning";
      case "WL":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <Card className="boarding-pass-card" elevation={3}>
      <CardContent>
        {/* Header */}
        <Box className="boarding-pass-header">
          <TrainIcon sx={{ fontSize: 40, color: "#1976d2" }} />
          <Typography
            variant="h5"
            component="div"
            sx={{ fontWeight: 700, ml: 2 }}
          >
            E-Boarding Pass
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Journey Status Banner */}
        <Box
          sx={{
            mb: 2,
            p: 2,
            borderRadius: 2,
            textAlign: "center",
            background: journeyStarted
              ? "linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%)"
              : "linear-gradient(135deg, #FFC107 0%, #FF9800 100%)",
            color: journeyStarted ? "white" : "#333",
          }}
        >
          {journeyStarted ? (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                🚂 Train is Running
              </Typography>
              <Typography variant="body2">
                Current Station: <strong>{currentStation || "Unknown"}</strong>
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                ⏳ Journey Not Started
              </Typography>
              <Typography variant="body2">
                The train journey has not begun yet
              </Typography>
            </>
          )}
        </Box>

        {/* QR Code Section */}
        {showQR && (
          <Box className="qr-section">
            <QRCodeSVG
              id="qr-code-svg"
              value={qrData}
              size={200}
              level="H"
              includeMargin={true}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 1, display: "block" }}
            >
              Scan at TTE verification
            </Typography>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Passenger Details */}
        <Grid container spacing={3} className="passenger-details">
          <Grid size={12}>
            <Typography variant="overline" color="text.secondary">
              Passenger Name
            </Typography>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              {passenger?.Name || "N/A"}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="overline" color="text.secondary">
              PNR Number
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontWeight: 600, fontSize: "1.1rem" }}
            >
              {passenger?.PNR_Number || "N/A"}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Status
            </Typography>
            <Box>
              <Chip
                label={passenger?.PNR_Status || "N/A"}
                color={getStatusColor(passenger?.PNR_Status)}
                size="small"
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </Grid>

          <Grid size={12}>
            <Typography variant="overline" color="text.secondary">
              Train
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {passenger?.Train_Name || "N/A"} (
              {passenger?.Train_Number || "N/A"})
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Date
            </Typography>
            <Typography variant="body1">
              {passenger?.Journey_Date || "N/A"}
            </Typography>
          </Grid>

          <Grid size={{ xs: 12, sm: 6 }}>
            <Typography variant="overline" color="text.secondary">
              Coach - Seat
            </Typography>
            <Typography variant="body1" sx={{ fontWeight: 600 }}>
              {passenger?.Assigned_Coach || "N/A"}-
              {passenger?.Assigned_berth || "N/A"}
            </Typography>
          </Grid>

          <Grid size={12}>
            <Typography variant="overline" color="text.secondary">
              Journey
            </Typography>
            <Typography variant="body1">
              {passenger?.Boarding_Station || "N/A"} →{" "}
              {passenger?.Deboarding_Station || "N/A"}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Action Buttons */}
        <Box className="action-buttons">
          <Button
            variant="contained"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            fullWidth
            sx={{ mb: 1 }}
          >
            Print Boarding Pass
          </Button>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            fullWidth
          >
            Download QR Code
          </Button>
        </Box>

        {/* Instructions */}
        <Box
          className="instructions"
          sx={{ mt: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}
        >
          <Typography variant="caption" color="text.secondary">
            📱 <strong>Instructions:</strong> Show this QR code to the TTE
            during boarding verification. Keep this pass ready on your mobile
            device.
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

export default BoardingPass;
