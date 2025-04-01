# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the requirements file into the container at /app
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# --no-cache-dir keeps the image size smaller
RUN pip install --no-cache-dir -r requirements.txt

# Create directory for persistent data (high scores) inside the container
# This MUST exist before the volume is mounted onto it
RUN mkdir /app/data

# Copy the rest of the application code into the container at /app
# This includes run.py, index.html, etc.
COPY . .

# Make port 8080 available to the world outside this container
# Fly.io will map external ports (80/443) to this internal port
EXPOSE 8080

# Define environment variable - Fly.io will set this based on internal_port below
ENV PORT=8080

# Run run.py when the container launches
CMD ["python3", "run.py"]
