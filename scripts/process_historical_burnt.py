import os
import json
import glob

def process_historical_burnt(data_dir, output_file):
    print("Starting processing of historical burnt areas...")
    trend_data = []

    pattern = os.path.join(data_dir, "Zimbabwe_Fire_*.geojson")
    files = glob.glob(pattern)

    for file_path in sorted(files):
        # Extract year from filename, e.g., Zimbabwe_Fire_2001.geojson
        basename = os.path.basename(file_path)
        year_str = basename.replace("Zimbabwe_Fire_", "").replace(".geojson", "")
        try:
            year = int(year_str)
        except ValueError:
            continue
        
        print(f"Processing {year}...")
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                features = data.get("features", [])
                
                # We count the number of burnt polygons/pixels
                count = len(features)
                
                trend_data.append({
                    "year": year,
                    "count": count
                })
        except Exception as e:
            print(f"Error reading {file_path}: {e}")

    # Sort by year just in case
    trend_data = sorted(trend_data, key=lambda x: x["year"])

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(trend_data, f, indent=2)

    print(f"Successfully wrote trend data to {output_file}")
    
if __name__ == "__main__":
    # Paths are relative to the project root where this is executed
    data_dir = os.path.join("data", "burnt")
    output_file = os.path.join("data", "historical_trend.json")
    process_historical_burnt(data_dir, output_file)
