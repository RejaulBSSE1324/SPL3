# %%--------------------------------Libraries---------------------
import numpy as np
import alphashape
from shapely.geometry import MultiPolygon, Polygon
import plotly.graph_objects as go
from skimage.measure import approximate_polygon
from scipy.interpolate import CubicSpline
from scipy.spatial.distance import cdist
import numpy as np
from scipy.spatial import cKDTree
import numpy as np
from scipy.spatial import cKDTree
import math

#%%-----------------------------DATA-----------------------
# Load your .pts data (after skipping the first row and ensuring you only get X, Y, Z)
file_path = 'C:/Users/Rejaul bsse 1324/Desktop/lidar/Building Boundary/Toronto/roof/build2.pts'  # Change to your file path
data = np.loadtxt(file_path, usecols=(0, 1, 2), skiprows=1)

# Extract X, Y, Z coordinates
x, y, z = data[:, 0], data[:, 1], data[:, 2]
points = np.column_stack((x, y, z))  

        
# %%--------------------------Visualize 2D-------------------
def visualize_2d_points(points_2d):
    """
    Visualize the 2D points using a scatter plot.
    
    Args:
        points_2d (numpy array): A 2D array where each row is a point (X, Y).
    """
    # Ensure points_2d is a numpy array
    points_2d = np.array(points_2d)

    # Extract X and Y coordinates
    x = points_2d[:, 0]
    y = points_2d[:, 1]

    # Create a scatter plot for the points
    trace = go.Scatter(
        x=x, 
        y=y, 
        mode='markers',  # 'markers' mode displays points
        marker=dict(
            size=3,  # Size of points
            color='blue',  # Color of points
            opacity=0.8  # Opacity of points
        )
    )

    # Layout for the plot
    layout = go.Layout(
        title='2D Points Visualization',
        xaxis_title='X',
        yaxis_title='Y',
        autosize=True
    )

    # Create and display the figure
    fig = go.Figure(data=[trace], layout=layout)
    fig.show(renderer="notebook")  # Change to "browser" if you want to view it in the browser

# Example of how to call the function
# Assuming points_2d is your 2D data (replace this with your actual 2D points)
# points_2d = np.random.rand(100, 2)  # Example data
# visualize_2d_points(points_2d)


# %%------------------ Projection to 2D -----------------------
points_2d = np.column_stack((x, y))


#%%
visualize_2d_points(points_2d)
