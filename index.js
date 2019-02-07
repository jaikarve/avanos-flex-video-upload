const sdk = require('kinvey-flex-sdk');
const b64 = require('base-64');
const axios = require('axios');
const fs = require('fs');

async function storeMetadata(orderId) {
    let kvFileConfig = {
        headers: {
            "Content-Type":"application/json",
            "Authorization": "Basic a2lkX0h5SXNJMWtnRTpmY2Y0ZDQyZGI2MjY0ZTA1YWI4YTQwYzU4ZDg3NjE1ZA==",
            "X-Kinvey-Content-Type":"video/mp4"
        }
    }

    let kvFilePostData = {
        "_filename": "sample-video.mp4",
        "myProperty": "some metadata",
        "someOtherProperty": "some more metadata",
        "procId":orderId,
        "mimeType":"video/mp4"
    }

    return axios.post("https://kvy-us2-baas.kinvey.com/blob/kid_HyIsI1kgE",
            kvFilePostData, kvFileConfig);
}

async function getGCSDownloadUrl(fileId) {
    let kvGetFileConfig = {
        headers: {
            "Authorization": "Basic a2lkX0h5SXNJMWtnRTpmY2Y0ZDQyZGI2MjY0ZTA1YWI4YTQwYzU4ZDg3NjE1ZA=="
        }
    };
    let getURI = "https://kvy-us2-baas.kinvey.com/blob/kid_HyIsI1kgE/" + fileId;
    return axios.get(getURI, kvGetFileConfig);
}


async function uploadToGCS(videoUrl, videoMetadata) {
    let uploadUrl = videoMetadata.data._uploadURL;
    videoUrl = videoUrl.replace("data:video/mp4;base64,","");
    var rawDataString = Buffer.from(videoUrl, 'base64');
    let gcsFileConfig = {
        headers: {
            "Content-Length": Buffer.byteLength(rawDataString, 'utf-8'),
            "Content-Type":"video/mp4"
        }
    }
    return axios.put(uploadUrl, rawDataString, gcsFileConfig);
}

async function storeVideoFile(videoUrl, orderId) {
    try {
        let metadata = await storeMetadata(orderId);
        let uploadResp = await uploadToGCS(videoUrl, metadata);
        let downloadResp = await getGCSDownloadUrl(metadata.data._id);
        return downloadResp;
    }
    catch (error) {
        console.log("Error: " + error);
    }
}

sdk.service((err, flex) => {
    if(err){
        console.log("could not initialize flex!");
        return;
    }

    let f = flex.functions;
    f.register('uploadVideoToPHC', async function(context, complete, modules){
        let requestBody = context.body;

        //console.dir("File upload: " + context.body.fileUpload);

        if(requestBody == null) {
            return complete().setBody({ "error": "must provide payload to convert"}).badRequest().done();
        }

        try {
            let downloadResp = await storeVideoFile(requestBody.videoUrl, requestBody.orderId);
            return complete().setBody({
                "statusCode":200,
                "downloadURL":downloadResp.data._downloadURL
            }).ok().done();
        }
        catch (error) {
            console.log("Error: " + error);
        }
    });
});