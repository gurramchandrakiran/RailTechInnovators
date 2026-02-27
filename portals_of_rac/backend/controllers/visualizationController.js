// backend/controllers/visualizationController.js

const trainController = require('./trainController');
const VisualizationService = require('../services/VisualizationService');
const SegmentService = require('../services/SegmentService');

class VisualizationController {
  /**
   * Get segment matrix
   */
  getSegmentMatrix(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const matrixData = VisualizationService.generateSegmentMatrixData(trainState);

      res.json({
        success: true,
        data: matrixData
      });

    } catch (error) {
      console.error("❌ Error getting segment matrix:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get graph data
   */
  getGraphData(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const graphData = VisualizationService.generateGraphData(trainState);

      res.json({
        success: true,
        data: graphData
      });

    } catch (error) {
      console.error("❌ Error getting graph data:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get heatmap data
   */
  getHeatmap(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const heatmapData = VisualizationService.generateHeatmapData(trainState);

      res.json({
        success: true,
        data: heatmapData
      });

    } catch (error) {
      console.error("❌ Error getting heatmap:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get berth timeline
   */
  getBerthTimeline(req, res) {
    try {
      const { coach, berth } = req.params;
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const timeline = SegmentService.getBerthOccupancyTimeline(trainState, coach, berth);

      if (!timeline) {
        return res.status(404).json({
          success: false,
          message: `Berth ${coach}-${berth} not found`
        });
      }

      res.json({
        success: true,
        data: {
          berth: `${coach}-${berth}`,
          timeline: timeline
        }
      });

    } catch (error) {
      console.error("❌ Error getting berth timeline:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  /**
   * Get vacancy matrix
   */
  getVacancyMatrix(req, res) {
    try {
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: "Train not initialized"
        });
      }

      const matrix = SegmentService.getVacancyMatrix(trainState);

      res.json({
        success: true,
        data: matrix
      });

    } catch (error) {
      console.error("❌ Error getting vacancy matrix:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
  // backend/controllers/visualizationController.js (ADD THIS METHOD)

  /**
   * Get train station schedule from MongoDB
   */
  async getStationSchedule(req, res) {
    try {
      // First check if train is initialized
      const trainState = trainController.getGlobalTrainState(req.query.trainNo || req.body.trainNo);

      if (!trainState) {
        return res.status(400).json({
          success: false,
          message: 'Train not initialized. Please initialize train on Home page first.'
        });
      }

      // If train is initialized, we can get stations from trainState directly
      if (trainState.stations && trainState.stations.length > 0) {
        const formattedStations = trainState.stations.map(s => ({
          sno: s.sno,
          code: s.code,
          name: s.name,
          arrival: s.arrival,
          departure: s.departure,
          distance: s.distance,
          day: s.day,
          halt: s.halt,
          zone: s.zone || 'South Central',
          division: s.division || 'Vijayawada',
          platform: s.platform || '-',
          remarks: s.remarks || '-'
        }));

        return res.json({
          success: true,
          data: {
            trainNo: trainState.trainNo,
            trainName: trainState.trainName,
            totalStations: formattedStations.length,
            stations: formattedStations
          }
        });
      }

      // Fallback: try to get from database if trainState doesn't have stations
      try {
        const db = require('../config/db');
        const stationsCollection = db.getStationsCollection();

        const stations = await stationsCollection
          .find({})
          .sort({ SNO: 1 })
          .toArray();

        if (!stations || stations.length === 0) {
          return res.status(404).json({
            success: false,
            message: 'No station data found in database'
          });
        }

        const formattedStations = stations.map(s => ({
          sno: s.SNO,
          code: s.Station_Code,
          name: s.Station_Name,
          arrival: s.Arrival_Time,
          departure: s.Departure_Time,
          distance: s.Distance,
          day: s.Day,
          halt: s.Halt_Duration,
          zone: s.Railway_Zone || 'South Central',
          division: s.Division || 'Vijayawada',
          platform: s.Platform_Number || '-',
          remarks: s.Remarks || '-'
        }));

        res.json({
          success: true,
          data: {
            trainNo: trainState.trainNo,
            trainName: trainState.trainName,
            totalStations: formattedStations.length,
            stations: formattedStations
          }
        });

      } catch (dbError) {
        console.error('❌ Database error:', dbError);
        return res.status(500).json({
          success: false,
          message: 'Database connection error. Please ensure train is properly initialized.'
        });
      }

    } catch (error) {
      console.error('❌ Error getting station schedule:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = new VisualizationController();