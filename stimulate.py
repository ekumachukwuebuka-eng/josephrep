import time
import json
import random
import math
import numpy as np

class NetPulseEngine:
    def __init__(self, tx_power_dbm=20.0, frequency_mhz=2400.0):
        """
        Initializes the communication engineering simulation engine.
        tx_power_dbm: Transmitter power in dBm (Default: 20dBm / 100mW)
        frequency_mhz: Carrier frequency in MHz (Default: 2.4 GHz WiFi band)
        """
        self.tx_power_dbm = tx_power_dbm
        self.frequency_mhz = frequency_mhz
        self.speed_of_light = 3e8
        
        # Calculate reference path loss at 1 meter using the Free Space Path Loss (FSPL) formula
        wavelength = self.speed_of_light / (frequency_mhz * 1e6)
        self.pl_0 = 20 * math.log10(4 * math.pi / wavelength)

    def calculate_path_loss(self, distance_m, environment_factor):
        """
        Implements the Log-Distance Path Loss Model.
        Formula: PL = PL_0 + 10 * n * log10(d) + X_sigma
        """
        if distance_m <= 0:
            distance_m = 0.1
            
        # Environment exponent (n): Rural/Free Space = 2.0, Urban/Buildings = 3.5, Dense Indoor = 4.5
        n_map = {"rural": 2.0, "urban": 3.5, "dense_indoor": 4.5}
        n = n_map.get(environment_factor, 3.0)
        
        # X_sigma: Log-normal shadowing component (Gaussian noise in dB)
        # Simulates environmental fading effects (multipath shadowing)
        shadowing_sigma = 4.0  # Standard deviation in dB
        x_sigma = np.random.normal(0, shadowing_sigma)
        
        # Core Log-Distance Formula
        path_loss = self.pl_0 + (10 * n * math.log10(distance_m)) + x_sigma
        return round(path_loss, 2)

    def calculate_ber(self, rx_power_dbm, noise_floor_dbm=-95.0):
        """
        Calculates the Bit Error Rate (BER) for Binary Phase Shift Keying (BPSK).
        Uses the Signal-to-Noise Ratio (SNR) and the mathematical Q-function approximation.
        """
        # Calculate SNR in dB
        snr_db = rx_power_dbm - noise_floor_dbm
        
        # Convert SNR from dB to linear scale (Eb/No approximation)
        snr_linear = 10 ** (snr_db / 10.0)
        
        if snr_linear <= 0:
            return 0.5  # Maximum uncertainty / complete corruption
            
        # BPSK theoretical BER formula: Q(sqrt(2 * SNR))
        # Approximating the Gaussian Q-function: Q(x) ≈ 0.5 * erfc(x / sqrt(2))
        x = math.sqrt(2 * snr_linear)
        ber = 0.5 * math.erfc(x / math.sqrt(2))
        
        # Bound BER between 0 and 0.5
        return max(min(ber, 0.5), 1e-6)

    def generate_packet_telemetry(self, ber):
        """
        Generates synthetic network telemetry packets impacted by the physical channel layer BER.
        """
        protocols = ["TCP", "UDP", "QUIC", "HTTP/3"]
        ips = ["192.168.1.50", "10.0.0.12", "172.16.254.1", "192.168.1.115"]
        
        # Simulating frame corruption based on Bit Error Rate
        # A packet fails if a random roll is lower than the probability of an error over its size
        packet_size_bytes = random.randint(64, 1518)  # Standard Ethernet frame sizes
        bit_count = packet_size_bytes * 8
        packet_loss_probability = 1 - ((1 - ber) ** bit_count)
        
        is_dropped = random.random() < packet_loss_probability
        
        # Base latency influenced by physical signal quality
        base_latency = random.uniform(5.0, 25.0)
        latency_penalty = (1 / (1 - ber + 1e-6)) * random.uniform(2.0, 15.0) if ber > 0.01 else 0
        latency_ms = round(base_latency + latency_penalty, 2)
        
        # Inject anomalous behaviors randomly (e.g., a burst DDoS simulation)
        is_anomaly = random.random() < 0.03
        if is_anomaly:
            packet_size_bytes = random.randint(5000, 65000)  # Oversized jumbo frames
            latency_ms = round(random.uniform(200.0, 450.0), 2)  # Major traffic spike
        
        packet = {
            "timestamp": round(time.time(), 3),
            "source_ip": random.choice(ips),
            "protocol": random.choice(protocols),
            "packet_size_bytes": packet_size_bytes,
            "latency_ms": latency_ms,
            "status": "DROPPED" if is_dropped else "SUCCESS",
            "anomaly_flag": is_anomaly
        }
        return packet

    def run_simulation_loop(self, distance_m=50, environment="urban"):
        """
        Runs a live execution tracking data processing loops to output to the console.
        """
        print(f"=== NetPulse Signal Simulator Engine Starting ===")
        print(f"Configured Transmitter Power: {self.tx_power_dbm} dBm at {self.frequency_mhz} MHz")
        print(f"Target Environment: Modeled as '{environment}' at a distance of {distance_m} meters.\n")
        
        try:
            while True:
                # 1. Physics Layer Math
                path_loss = self.calculate_path_loss(distance_m, environment)
                rx_power = self.tx_power_dbm - path_loss
                ber = self.calculate_ber(rx_power)
                
                # 2. Network Layer Telemetry Generation
                telemetry = self.generate_packet_telemetry(ber)
                
                # 3. Append Calculated Physics Data to Telemetry payload for Full Stack Insight
                telemetry["metrics"] = {
                    "path_loss_db": path_loss,
                    "rx_power_dbm": round(rx_power, 2),
                    "bit_error_rate": f"{ber:.4e}"
                }
                
                # Print clean, formatted JSON out to console
                print(json.dumps(telemetry, indent=2))
                
                # Stream velocity simulation spacing
                time.sleep(0.8)
                
        except KeyboardInterrupt:
            print("\nSimulation engine gracefully paused.")

if __name__ == "__main__":
    # Instantiating the engine with a 2.4 GHz wireless setup
    engine = NetPulseEngine(tx_power_dbm=20.0, frequency_mhz=2400.0)
    
    # Running a test cycle replicating an urban environment obstacle density at 75 meters away
    engine.run_simulation_loop(distance_m=75, environment="urban")